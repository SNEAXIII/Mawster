import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '../..');
const FRONT_DIR = path.join(ROOT, 'front');
const RESULTS_DIR = path.join(FRONT_DIR, 'cypress', 'results');
const REPORTS_DIR = path.join(RESULTS_DIR, 'reports');
const VIDEOS_DIR = path.join(RESULTS_DIR, 'videos');
const SCREENSHOTS_DIR = path.join(RESULTS_DIR, 'screenshots');
const HISTORY_FILE = path.join(ROOT, 'runner-results', 'e2e-history.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearResults(): void {
  for (const dir of [REPORTS_DIR, VIDEOS_DIR, SCREENSHOTS_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

interface TestFailure {
  spec: string;
  suite: string;
  test: string;
  error: string;
}

interface TestResults {
  summary: { total: number; passed: number; failed: number };
  failures: TestFailure[];
}

function parseXmlResults(): TestResults {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['testsuite', 'testcase'].includes(name),
  });

  let total = 0;
  let failed = 0;
  const failures: TestFailure[] = [];

  if (!fs.existsSync(REPORTS_DIR))
    return { summary: { total: 0, passed: 0, failed: 0 }, failures: [] };

  const xmlFiles = fs.readdirSync(REPORTS_DIR).filter((f) => f.endsWith('.xml'));

  for (const file of xmlFiles) {
    const content = fs.readFileSync(path.join(REPORTS_DIR, file), 'utf-8');
    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(content) as Record<string, unknown>;
    } catch {
      continue;
    }

    const root = (parsed['testsuites'] ?? parsed['testsuite']) as
      | Record<string, unknown>
      | undefined;
    if (!root) continue;

    const suites: unknown[] = Array.isArray(root['testsuite'])
      ? (root['testsuite'] as unknown[])
      : root['testsuite']
        ? [root['testsuite']]
        : [root];

    for (const suite of suites) {
      const s = suite as Record<string, unknown>;
      const suiteName = (s['@_name'] as string) ?? 'unknown';
      const suiteTests = parseInt((s['@_tests'] as string) ?? '0', 10);
      const suiteFailures = parseInt((s['@_failures'] as string) ?? '0', 10);

      total += suiteTests;
      failed += suiteFailures;

      if (suiteFailures === 0) continue;

      const testcases: unknown[] = Array.isArray(s['testcase'])
        ? (s['testcase'] as unknown[])
        : s['testcase']
          ? [s['testcase']]
          : [];

      for (const tc of testcases) {
        const t = tc as Record<string, unknown>;
        if (!t['failure'] && !t['error']) continue;

        const failureNode = (t['failure'] ?? t['error']) as Record<string, unknown> | string;
        const errorMessage =
          typeof failureNode === 'string'
            ? failureNode
            : ((failureNode['#text'] as string) ??
              (failureNode['@_message'] as string) ??
              JSON.stringify(failureNode));

        failures.push({
          spec: (t['@_classname'] as string) ?? suiteName,
          suite: suiteName,
          test: (t['@_name'] as string) ?? 'unknown',
          error: errorMessage.trim(),
        });
      }
    }
  }

  return {
    summary: { total, passed: total - failed, failed },
    failures,
  };
}

// ── History ───────────────────────────────────────────────────────────────────

interface HistoryEntry {
  timestamp: string;
  branch: string;
  type: 'all' | 'specific' | 'failing' | 'parallel';
  specs?: string[];
  durationMs: number;
  summary: { total: number; passed: number; failed: number };
  failedTests: string[];
}

function currentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: 'pipe' })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function saveToHistory(entry: HistoryEntry): void {
  const dir = path.dirname(HISTORY_FILE);
  fs.mkdirSync(dir, { recursive: true });

  let history: HistoryEntry[] = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as HistoryEntry[];
    } catch {
      history = [];
    }
  }

  history.push(entry);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function runCypress(specs?: string[]): TestResults {
  clearResults();

  const specArg = specs && specs.length > 0 ? `--spec "${specs.join(',')}"` : '';

  const cmd = `npx cypress run ${specArg}`.trim();

  try {
    execSync(cmd, { cwd: FRONT_DIR, stdio: 'pipe', timeout: 600_000 });
  } catch {
    // Cypress exits with code 1 when tests fail — not a real error
  }

  return parseXmlResults();
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'cypress-runner',
  version: '1.0.0',
});

server.registerTool(
  'run_all_tests',
  {
    description:
      "Supprime les résultats précédents, lance tous les tests Cypress, et retourne le résumé ainsi que les détails de chaque test échoué (suite, nom du test, message d'erreur).",
  },
  async () => {
    const start = Date.now();
    const results = runCypress();
    const durationMs = Date.now() - start;
    saveToHistory({
      timestamp: new Date().toISOString(),
      branch: currentBranch(),
      type: 'all',
      durationMs,
      summary: results.summary,
      failedTests: results.failures.map((f) => f.test),
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.registerTool(
  'run_specific_tests',
  {
    description:
      'Lance uniquement les specs Cypress spécifiées (par fichier et/ou filtre de nom), et retourne le résumé + détails des échecs. Utiliser pour cibler un seul fichier de test ou un seul test par son nom.',
    inputSchema: {
      spec_files: z
        .array(z.string())
        .describe(
          'Liste des chemins de specs à lancer, relatifs au dossier front/. Ex: ["cypress/e2e/war/management.cy.ts"]'
        ),
      grep: z
        .string()
        .optional()
        .describe(
          'Filtre optionnel sur le nom du test (passé à --env grep=...). Ex: "ended war shows"'
        ),
    },
  },
  async ({ spec_files, grep }) => {
    clearResults();

    const start = Date.now();
    const specArg = spec_files.length > 0 ? `--spec "${spec_files.join(',')}"` : '';
    const grepArg = grep ? `--env grep="${grep}"` : '';
    const cmd = `npx cypress run ${specArg} ${grepArg}`.trim();

    try {
      execSync(cmd, { cwd: FRONT_DIR, stdio: 'pipe', timeout: 600_000 });
    } catch {
      // Cypress exits with code 1 when tests fail — not a real error
    }

    const durationMs = Date.now() - start;
    const results = parseXmlResults();
    saveToHistory({
      timestamp: new Date().toISOString(),
      branch: currentBranch(),
      type: 'specific',
      specs: spec_files,
      durationMs,
      summary: results.summary,
      failedTests: results.failures.map((f) => f.test),
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.registerTool(
  'run_failing_tests',
  {
    description:
      'Supprime les résultats précédents, relance uniquement les specs Cypress spécifiées, et retourne les résultats. À utiliser après avoir corrigé des tests échoués.',
    inputSchema: {
      spec_files: z
        .array(z.string())
        .describe(
          'Liste des chemins de specs à relancer, relatifs au dossier front/. Ex: ["cypress/e2e/defense/operations.cy.ts"]'
        ),
    },
  },
  async ({ spec_files }) => {
    const start = Date.now();
    const results = runCypress(spec_files);
    const durationMs = Date.now() - start;
    saveToHistory({
      timestamp: new Date().toISOString(),
      branch: currentBranch(),
      type: 'failing',
      specs: spec_files,
      durationMs,
      summary: results.summary,
      failedTests: results.failures.map((f) => f.test),
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.registerTool(
  'run_parallel',
  {
    description:
      'Lance les tests E2E en parallèle via e2e_parallel.py (plusieurs workers, chacun avec son propre backend+frontend+DB). Retourne le rapport enrichi avec les logs backend par test échoué. Nécessite Docker (mariadb-test sur le port 3307).',
    inputSchema: {
      workers: z
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .describe('Nombre de workers parallèles (1-8, défaut: 2)'),
      spec: z
        .string()
        .optional()
        .describe(
          'Spec unique à lancer (relatif à front/cypress/e2e/). Ex: "war/war.cy.ts". Force 1 worker.'
        ),
    },
  },
  async ({ workers = 2, spec }) => {
    const REPORT_FILE = path.join(RESULTS_DIR, 'report.json');
    const start = Date.now();

    const workersArg = spec ? '' : `--workers ${workers}`;
    const specArg = spec ? `--spec "${spec}"` : '';
    const cmd = `python scripts/e2e_parallel.py ${workersArg} ${specArg} --quiet`.trim();

    try {
      execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 1_200_000 });
    } catch {
      // e2e_parallel.py exits with non-zero when tests fail — not a real error
    }

    const durationMs = Date.now() - start;

    let report: unknown = { summary: { tests: 0, passing: 0, failing: 0 }, failures: [] };
    if (fs.existsSync(REPORT_FILE)) {
      try {
        report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
      } catch {
        // keep empty report
      }
    }

    const typedReport = report as {
      summary: { tests: number; passing: number; failing: number };
      failures: { title: string }[];
    };

    saveToHistory({
      timestamp: new Date().toISOString(),
      branch: currentBranch(),
      type: 'parallel',
      specs: spec ? [spec] : undefined,
      durationMs,
      summary: {
        total: typedReport.summary.tests,
        passed: typedReport.summary.passing,
        failed: typedReport.summary.failing,
      },
      failedTests: typedReport.failures.map((f) => f.title),
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
