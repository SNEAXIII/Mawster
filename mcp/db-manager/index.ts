import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// ── Paths ──────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '../..');
const API_DIR = path.join(ROOT, 'api');
const STATE_FILE = path.join(ROOT, '.server-runner-state.json');

// ── Helpers ────────────────────────────────────────────────────────────────────

function readApiPort(): number {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('No server running — start one with server-runner first.');
  }
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as { mode: string };
  return state.mode === 'test' ? 8001 : 8000;
}

function httpPost(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port, path, method: 'POST', timeout: 30_000 },
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

function runPython(module: string): { success: boolean; output: string } {
  try {
    const output = execSync(`uv run python -m ${module}`, {
      cwd: API_DIR,
      timeout: 120_000,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim() || e.message || 'Unknown error';
    return { success: false, output };
  }
}

function runAlembic(args: string): { success: boolean; output: string } {
  try {
    const output = execSync(`uv run alembic ${args}`, {
      cwd: API_DIR,
      timeout: 60_000,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr].filter(Boolean).join('\n').trim() || e.message || 'Unknown error';
    return { success: false, output };
  }
}

// ── MCP Server ─────────────────────────────────────────────────────────────────

const server = new McpServer({ name: 'db-manager', version: '1.0.0' });

server.registerTool(
  'truncate',
  { description: 'Truncate all DB tables via POST /dev/truncate. Requires the API server to be running (dev or test mode).' },
  async () => {
    let port: number;
    try {
      port = readApiPort();
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }] };
    }
    try {
      const res = await httpPost(port, '/dev/truncate');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: res.status === 200, status: res.status, body: res.body }, null, 2),
        }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: (err as Error).message }) }] };
    }
  },
);

server.registerTool(
  'fixtures',
  { description: 'Load sample data (30 users, 1 alliance). Use setup tool instead for a full reset+champions+fixtures in one shot.' },
  async () => {
    const result = runPython('src.fixtures.sample_data');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  'reset_db',
  { description: 'Destructive: drop all tables then run alembic upgrade head. Does not reload any data.' },
  async () => {
    const result = runPython('src.fixtures.reset_db');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  'load_champions',
  { description: 'Load/update champions from scripts/champions.json into the DB. Idempotent — safe to re-run.' },
  async () => {
    const result = runPython('src.fixtures.load_champions');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  'setup',
  { description: 'Full setup: reset_db → load_champions → fixtures. Stops on first failure.' },
  async () => {
    const steps: Array<{ step: string; success: boolean; output: string }> = [];

    const reset = runPython('src.fixtures.reset_db');
    steps.push({ step: 'reset_db', ...reset });
    if (!reset.success) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, steps }, null, 2) }] };
    }

    const champions = runPython('src.fixtures.load_champions');
    steps.push({ step: 'load_champions', ...champions });
    if (!champions.success) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, steps }, null, 2) }] };
    }

    const fixtures = runPython('src.fixtures.sample_data');
    steps.push({ step: 'fixtures', ...fixtures });

    return { content: [{ type: 'text', text: JSON.stringify({ success: fixtures.success, steps }, null, 2) }] };
  },
);

server.registerTool(
  'migrate',
  { description: 'Run pending Alembic migrations (alembic upgrade head).' },
  async () => {
    const result = runAlembic('upgrade head');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
