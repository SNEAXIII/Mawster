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
    const results = runCypress();
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

    const specArg = spec_files.length > 0 ? `--spec "${spec_files.join(',')}"` : '';
    const grepArg = grep ? `--env grep="${grep}"` : '';
    const cmd = `npx cypress run ${specArg} ${grepArg}`.trim();

    try {
      execSync(cmd, { cwd: FRONT_DIR, stdio: 'pipe', timeout: 600_000 });
    } catch {
      // Cypress exits with code 1 when tests fail — not a real error
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(parseXmlResults(), null, 2) }],
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
    const results = runCypress(spec_files);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
