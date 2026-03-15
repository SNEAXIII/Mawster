import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { XMLParser } from 'fast-xml-parser';

// ── Paths ──────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '../..');
const API_DIR = path.join(ROOT, 'api');
const FRONT_DIR = path.join(ROOT, 'front');
const STATE_FILE = path.join(ROOT, '.server-runner-state.json');
const REPORTS_DIR = path.join(FRONT_DIR, 'cypress', 'results', 'reports');
const VIDEOS_DIR = path.join(FRONT_DIR, 'cypress', 'results', 'videos');
const SCREENSHOTS_DIR = path.join(FRONT_DIR, 'cypress', 'results', 'screenshots');

// ── Types ──────────────────────────────────────────────────────────────────────

type Mode = 'dev' | 'test';

interface State {
  mode: Mode;
  pids: { api: number; front: number };
  startedAt: string;
}

interface CypressResults {
  summary: { total: number; passed: number; failed: number };
  failures: Array<{ spec: string; suite: string; test: string; error: string }>;
}

// ── State helpers ──────────────────────────────────────────────────────────────

function readState(): State | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as State;
  } catch {
    return null;
  }
}

function writeState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
  fs.rmSync(STATE_FILE, { force: true });
}

// ── Process helpers ────────────────────────────────────────────────────────────

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid: number): void {
  if (!isAlive(pid)) return;
  try {
    if (process.platform === 'win32') {
      // /T kills the full process tree (cmd.exe + its children)
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'pipe' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // Already dead — ignore
  }
}

function stopAll(): void {
  const state = readState();
  if (!state) return;
  killPid(state.pids.api);
  killPid(state.pids.front);
  clearState();
}

function spawnDetached(cmdArgs: string[], cwd: string, env?: Record<string, string>): number {
  // Wrap in cmd /c on Windows so PATH resolution works for uv, npm, etc.
  const child = spawn('cmd', ['/c', cmdArgs.join(' ')], {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'ignore',
    detached: true,
    windowsHide: true,
  });
  child.unref();
  if (child.pid === undefined) throw new Error(`Failed to spawn: ${cmdArgs.join(' ')}`);
  return child.pid;
}

// ── Port helpers ───────────────────────────────────────────────────────────────

function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const check = (): void => {
      const req = http.get(
        { hostname: 'localhost', port, path: '/', timeout: 1000 },
        () => resolve(true),
      );
      req.on('error', () => {
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(check, 2000);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() >= deadline) return resolve(false);
        setTimeout(check, 2000);
      });
    };

    check();
  });
}

// ── Start helpers ──────────────────────────────────────────────────────────────

async function startDev(): Promise<State> {
  stopAll();

  execSync('docker compose -f compose-dev.yaml up mariadb phpmyadmin -d', { cwd: ROOT, stdio: 'pipe' });

  const apiPid = spawnDetached(['uv', 'run', 'fastapi', 'dev', '--reload'], API_DIR);
  const frontPid = spawnDetached(['npm', 'run', 'dev'], FRONT_DIR);

  await waitForPort(8000, 60_000);
  await waitForPort(3000, 120_000);

  const state: State = { mode: 'dev', pids: { api: apiPid, front: frontPid }, startedAt: new Date().toISOString() };
  writeState(state);
  return state;
}

async function startTest(): Promise<State> {
  stopAll();

  execSync('docker compose -f compose-dev.yaml up mariadb-test phpmyadmin-test -d', { cwd: ROOT, stdio: 'pipe' });

  const apiPid = spawnDetached(['uv', 'run', 'app_testing.py'], API_DIR, { MODE: 'testing' });
  const frontPid = spawnDetached(['npm', 'run', 'testing'], FRONT_DIR, {
    NEXTAUTH_SECRET: 'e2e-local-nextauth-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
  });

  await waitForPort(8001, 60_000);
  await waitForPort(3000, 120_000);

  const state: State = { mode: 'test', pids: { api: apiPid, front: frontPid }, startedAt: new Date().toISOString() };
  writeState(state);
  return state;
}

// ── Cypress helpers ────────────────────────────────────────────────────────────

function clearCypressResults(): void {
  for (const dir of [REPORTS_DIR, VIDEOS_DIR, SCREENSHOTS_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseCypressResults(): CypressResults {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['testsuite', 'testcase'].includes(name),
  });

  let total = 0, failed = 0;
  const failures: CypressResults['failures'] = [];

  if (!fs.existsSync(REPORTS_DIR)) return { summary: { total: 0, passed: 0, failed: 0 }, failures: [] };

  const xmlFiles = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.xml'));
  for (const file of xmlFiles) {
    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8')) as Record<string, unknown>;
    } catch {
      continue;
    }

    const root = (parsed['testsuites'] ?? parsed['testsuite']) as Record<string, unknown> | undefined;
    if (!root) continue;

    const suites: unknown[] = Array.isArray(root['testsuite'])
      ? (root['testsuite'] as unknown[])
      : root['testsuite'] ? [root['testsuite']] : [root];

    for (const suite of suites) {
      const s = suite as Record<string, unknown>;
      const suiteName = (s['@_name'] as string) ?? 'unknown';
      total += parseInt((s['@_tests'] as string) ?? '0', 10);
      const suiteFailures = parseInt((s['@_failures'] as string) ?? '0', 10);
      failed += suiteFailures;
      if (suiteFailures === 0) continue;

      const testcases: unknown[] = Array.isArray(s['testcase'])
        ? (s['testcase'] as unknown[])
        : s['testcase'] ? [s['testcase']] : [];

      for (const tc of testcases) {
        const t = tc as Record<string, unknown>;
        if (!t['failure'] && !t['error']) continue;
        const node = (t['failure'] ?? t['error']) as Record<string, unknown> | string;
        const error = typeof node === 'string'
          ? node
          : ((node['#text'] as string) ?? (node['@_message'] as string) ?? JSON.stringify(node));
        failures.push({
          spec: (t['@_classname'] as string) ?? suiteName,
          suite: suiteName,
          test: (t['@_name'] as string) ?? 'unknown',
          error: error.trim(),
        });
      }
    }
  }

  return { summary: { total, passed: total - failed, failed }, failures };
}

function runCypress(specs?: string[]): CypressResults {
  clearCypressResults();
  const specArg = specs && specs.length > 0 ? `--spec "${specs.join(',')}"` : '';
  try {
    execSync(`npx cypress run ${specArg}`.trim(), { cwd: FRONT_DIR, stdio: 'pipe', timeout: 600_000 });
  } catch {
    // Cypress exits with code 1 when tests fail — not a real error
  }
  return parseCypressResults();
}

// ── Uptime helper ──────────────────────────────────────────────────────────────

function formatUptime(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// ── MCP Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'server-runner', version: '1.0.0' });

server.registerTool(
  'start_dev',
  { description: 'Lance mariadb (3306) + API FastAPI (port 8000) + Frontend Next.js (port 3000) en mode dev. Arrête le mode test si actif.' },
  async () => {
    const state = await startDev();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ready',
          mode: state.mode,
          ports: { api: 8000, front: 3000, phpmyadmin: 8080 },
          pids: state.pids,
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'start_test',
  { description: 'Lance mariadb-test (3307) + API FastAPI (port 8001) + Frontend Next.js (port 3000) en mode test. Arrête le mode dev si actif.' },
  async () => {
    const state = await startTest();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ready',
          mode: state.mode,
          ports: { api: 8001, front: 3000, phpmyadmin: 8081 },
          pids: state.pids,
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'stop',
  { description: 'Arrête tous les serveurs (API + Frontend) démarrés via server-runner, quel que soit le mode.' },
  async () => {
    const state = readState();
    if (!state) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'already_stopped' }) }] };
    }
    stopAll();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ status: 'stopped', mode: state.mode, pids: state.pids }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'status',
  { description: 'Retourne le mode actif (dev/test/none), les PIDs, les ports, et l\'uptime des serveurs démarrés via server-runner.' },
  async () => {
    const state = readState();
    if (!state) {
      return { content: [{ type: 'text', text: JSON.stringify({ running: false }) }] };
    }
    const apiAlive = isAlive(state.pids.api);
    const frontAlive = isAlive(state.pids.front);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          running: apiAlive || frontAlive,
          mode: state.mode,
          ports: state.mode === 'dev' ? { api: 8000, front: 3000, phpmyadmin: 8080 } : { api: 8001, front: 3000, phpmyadmin: 8081 },
          pids: state.pids,
          alive: { api: apiAlive, front: frontAlive },
          uptime: formatUptime(state.startedAt),
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'run_e2e',
  { description: 'Démarre les serveurs en mode test si nécessaire, puis lance tous les tests Cypress E2E et retourne le résumé + les détails des échecs.' },
  async () => {
    const state = readState();
    if (!state || state.mode !== 'test') {
      await startTest();
    }
    const results = runCypress();
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  },
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
