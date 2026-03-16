import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

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
  pids: { apis: number[]; fronts: number[] };
  startedAt: string;
  dbNames: string[];
  threads: number;
}

interface CypressResults {
  summary: { total: number; passed: number; failed: number };
  failures: Array<{ spec: string; suite: string; test: string; error: string }>;
}

// ── Env file helper ────────────────────────────────────────────────────────────

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
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
  const raw = readState();
  if (!raw) return;

  // Normalize: support old format { api, front } and new format { apis, fronts }
  const anyPids = raw.pids as unknown as Record<string, unknown>;
  const apiPids: number[] = Array.isArray(anyPids['apis'])
    ? (anyPids['apis'] as number[])
    : typeof anyPids['api'] === 'number' ? [anyPids['api'] as number] : [];
  const frontPids: number[] = Array.isArray(anyPids['fronts'])
    ? (anyPids['fronts'] as number[])
    : typeof anyPids['front'] === 'number' ? [anyPids['front'] as number] : [];

  for (const pid of [...apiPids, ...frontPids]) killPid(pid);

  const dbNames: string[] = Array.isArray(raw.dbNames)
    ? raw.dbNames
    : (raw as unknown as { dbName?: string }).dbName ? [(raw as unknown as { dbName: string }).dbName] : [];

  if (dbNames.length > 0) {
    try {
      const dbEnv = parseEnvFile(path.join(ROOT, 'db.env'));
      const rootPwd = dbEnv['MARIADB_ROOT_PASSWORD'] ?? '';
      const dropSql = dbNames.map((n) => `DROP DATABASE IF EXISTS \`${n}\`;`).join(' ');
      execSync(
        `docker exec mariadb-test mysql -uroot -p${rootPwd} -e "${dropSql}"`,
        { stdio: 'pipe' },
      );
    } catch {
      // Container not available — ignored
    }
  }

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

  const state: State = { mode: 'dev', pids: { apis: [apiPid], fronts: [frontPid] }, startedAt: new Date().toISOString(), dbNames: [], threads: 1 };
  writeState(state);
  return state;
}

async function startTest(threads = 1): Promise<State> {
  stopAll();

  execSync('docker compose -f compose-dev.yaml up mariadb-test phpmyadmin-test -d', { cwd: ROOT, stdio: 'pipe' });

  const dbEnv = parseEnvFile(path.join(ROOT, 'db.env'));
  const rootPwd = dbEnv['MARIADB_ROOT_PASSWORD'] ?? '';

  const dbNames: string[] = [];
  const apiPids: number[] = [];
  const frontPids: number[] = [];

  for (let i = 0; i < threads; i++) {
    const dbName = `mawster_e2e_${crypto.randomBytes(4).toString('hex')}`;
    execSync(
      `docker exec mariadb-test mysql -uroot -p${rootPwd} -e "CREATE DATABASE IF NOT EXISTS \`${dbName}\`;"`,
      { stdio: 'pipe' },
    );
    dbNames.push(dbName);

    const apiPort = 8001 + i;
    const frontPort = 3000 + i;

    apiPids.push(spawnDetached(['uv', 'run', 'app_testing.py'], API_DIR, {
      MODE: 'testing',
      MARIADB_DATABASE: dbName,
      PORT: String(apiPort),
    }));
    frontPids.push(spawnDetached(['npm', 'run', 'testing'], FRONT_DIR, {
      NEXTAUTH_SECRET: 'e2e-local-nextauth-secret',
      NEXTAUTH_URL: `http://localhost:${frontPort}`,
      PORT: String(frontPort),
      API_PORT: String(apiPort),
    }));
  }

  await Promise.all([
    ...apiPids.map((_, i) => waitForPort(8001 + i, 60_000)),
    ...frontPids.map((_, i) => waitForPort(3000 + i, 120_000)),
  ]);

  const state: State = {
    mode: 'test',
    pids: { apis: apiPids, fronts: frontPids },
    startedAt: new Date().toISOString(),
    dbNames,
    threads,
  };
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

function findSpecs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findSpecs(full));
    else if (entry.name.endsWith('.cy.ts') || entry.name.endsWith('.cy.js')) results.push(full);
  }
  return results;
}

function spawnCypressProcess(specFiles: string[], threadIndex: number): Promise<void> {
  const backendPort = 8001 + threadIndex;
  const frontPort = 3000 + threadIndex;
  const specList = specFiles.map((s) => path.relative(FRONT_DIR, s)).join(',');
  const cmd = [
    'npx cypress run',
    `--spec "${specList}"`,
    `--config "baseUrl=http://localhost:${frontPort},videosFolder=cypress/results/videos/thread-${threadIndex},screenshotsFolder=cypress/results/screenshots/thread-${threadIndex}"`,
    `--env "backendUrl=http://localhost:${backendPort}"`,
  ].join(' ');
  return new Promise((resolve) => {
    const proc = spawn('cmd', ['/c', cmd], { cwd: FRONT_DIR, stdio: 'pipe', windowsHide: true });
    proc.on('close', () => resolve());
    proc.on('error', () => resolve());
  });
}

async function runCypress(threads = 1, specs?: string[]): Promise<CypressResults> {
  clearCypressResults();

  if (specs && specs.length > 0) {
    // Re-run specific specs: always use thread 0
    await spawnCypressProcess(
      specs.map((s) => path.join(FRONT_DIR, s)),
      0,
    );
  } else {
    const allSpecs = findSpecs(path.join(FRONT_DIR, 'cypress', 'e2e'));
    const groups: string[][] = Array.from({ length: threads }, () => []);
    allSpecs.forEach((spec, i) => groups[i % threads].push(spec));
    await Promise.all(groups.map((group, i) => group.length > 0 ? spawnCypressProcess(group, i) : Promise.resolve()));
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
  {
    description: 'Lance mariadb-test (3307) + N paires API/Frontend en mode test, chacune avec sa propre DB aléatoire. threads=1 par défaut.',
    inputSchema: { threads: z.number().int().min(1).max(8).optional().describe('Nombre de workers parallèles (défaut: 1)') },
  },
  async ({ threads = 1 }) => {
    const state = await startTest(threads);
    const apis = state.pids.apis.map((_, i) => 8001 + i);
    const fronts = state.pids.fronts.map((_, i) => 3000 + i);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ready',
          mode: state.mode,
          threads: state.threads,
          ports: { apis, fronts, phpmyadmin: 8081 },
          dbNames: state.dbNames,
          pids: state.pids,
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'stop',
  { description: 'Arrête tous les serveurs (API + Frontend) démarrés via server-runner, quel que soit le mode. Supprime aussi les DBs de test aléatoires.' },
  async () => {
    const state = readState();
    if (!state) {
      return { content: [{ type: 'text', text: JSON.stringify({ status: 'already_stopped' }) }] };
    }
    stopAll();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ status: 'stopped', mode: state.mode, threads: state.threads, dbNames: state.dbNames }, null, 2),
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
    const apisAlive = state.pids.apis.map(isAlive);
    const frontsAlive = state.pids.fronts.map(isAlive);
    const anyAlive = [...apisAlive, ...frontsAlive].some(Boolean);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          running: anyAlive,
          mode: state.mode,
          threads: state.threads,
          ports: state.mode === 'dev'
            ? { apis: [8000], fronts: [3000], phpmyadmin: 8080 }
            : { apis: state.pids.apis.map((_, i) => 8001 + i), fronts: state.pids.fronts.map((_, i) => 3000 + i), phpmyadmin: 8081 },
          dbNames: state.dbNames,
          pids: state.pids,
          alive: { apis: apisAlive, fronts: frontsAlive },
          uptime: formatUptime(state.startedAt),
        }, null, 2),
      }],
    };
  },
);

server.registerTool(
  'run_e2e',
  {
    description: 'Démarre les serveurs en mode test si nécessaire, puis lance tous les tests Cypress E2E en parallèle et retourne le résumé + les détails des échecs.',
    inputSchema: { threads: z.number().int().min(1).max(8).optional().describe('Nombre de workers parallèles (défaut: 1)') },
  },
  async ({ threads = 1 }) => {
    const state = readState();
    if (!state || state.mode !== 'test' || state.threads !== threads) {
      await startTest(threads);
    }
    const results = await runCypress(threads);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  },
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
