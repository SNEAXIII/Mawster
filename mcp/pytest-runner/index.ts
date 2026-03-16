import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(import.meta.dirname, '../..');
const API_DIR = path.join(ROOT, 'api');
const RESULTS_DIR = path.join(API_DIR, 'test-results');
const JUNIT_XML = path.join(RESULTS_DIR, 'junit.xml');

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestFailure {
  spec: string;
  test: string;
  error: string;
}

interface TestResults {
  summary: { total: number; passed: number; failed: number; error: number };
  failures: TestFailure[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseXmlResults(): TestResults {
  if (!fs.existsSync(JUNIT_XML)) {
    return { summary: { total: 0, passed: 0, failed: 0, error: 0 }, failures: [] };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['testsuite', 'testcase'].includes(name),
  });

  const content = fs.readFileSync(JUNIT_XML, 'utf-8');
  const parsed = parser.parse(content) as Record<string, unknown>;

  const root = (parsed['testsuites'] ?? parsed['testsuite']) as Record<string, unknown> | undefined;
  if (!root) return { summary: { total: 0, passed: 0, failed: 0, error: 0 }, failures: [] };

  const suites: unknown[] = Array.isArray(root['testsuite'])
    ? (root['testsuite'] as unknown[])
    : root['testsuite']
      ? [root['testsuite']]
      : [root];

  let total = 0;
  let failed = 0;
  let errors = 0;
  const failures: TestFailure[] = [];

  for (const suite of suites) {
    const s = suite as Record<string, unknown>;
    total += parseInt((s['@_tests'] as string) ?? '0', 10);
    failed += parseInt((s['@_failures'] as string) ?? '0', 10);
    errors += parseInt((s['@_errors'] as string) ?? '0', 10);

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
        spec: (t['@_classname'] as string) ?? 'unknown',
        test: (t['@_name'] as string) ?? 'unknown',
        error: errorMessage.trim(),
      });
    }
  }

  return {
    summary: { total, passed: total - failed - errors, failed, error: errors },
    failures,
  };
}

function runPytest(paths?: string[], keyword?: string, verbose = false): TestResults {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  if (fs.existsSync(JUNIT_XML)) fs.unlinkSync(JUNIT_XML);

  const parts: string[] = ['uv run pytest'];
  if (paths && paths.length > 0) parts.push(paths.join(' '));
  if (keyword) parts.push(`-k "${keyword}"`);
  parts.push('--junit-xml=test-results/junit.xml');
  parts.push(verbose ? '-v' : '-q');

  const cmd = parts.join(' ');

  try {
    execSync(cmd, { cwd: API_DIR, stdio: 'pipe', timeout: 300_000 });
  } catch {
    // pytest exits with code 1 when tests fail — not a real error
  }

  return parseXmlResults();
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'pytest-runner',
  version: '1.0.0',
});

server.registerTool(
  'run_all_tests',
  {
    description:
      "Supprime les résultats précédents, lance tous les tests pytest, et retourne le résumé ainsi que les détails de chaque test échoué (spec, nom du test, message d'erreur).",
  },
  async () => {
    const results = runPytest();
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.registerTool(
  'run_failing_tests',
  {
    description:
      'Supprime les résultats précédents, relance uniquement les fichiers ou tests pytest spécifiés, et retourne les résultats.',
    inputSchema: {
      paths: z
        .array(z.string())
        .describe(
          'Liste des chemins de tests à relancer, relatifs au dossier api/. Ex: ["tests/unit/dto/dto_from_model_test.py"]'
        ),
    },
  },
  async ({ paths }) => {
    const results = runPytest(paths);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.registerTool(
  'run_specific_tests',
  {
    description:
      'Lance des tests pytest spécifiques par chemin/ID et/ou mot-clé -k, et retourne les résultats.',
    inputSchema: {
      paths: z
        .array(z.string())
        .optional()
        .describe(
          'Chemins ou IDs de tests relatifs au dossier api/. Ex: ["tests/unit/dto/dto_war_test.py::TestWarResponseDTO"]'
        ),
      keyword: z
        .string()
        .optional()
        .describe(
          'Expression -k pour filtrer les tests. Ex: "test_end_war or test_create_war"'
        ),
      verbose: z
        .boolean()
        .optional()
        .describe('Affichage verbeux (-v). Par défaut false.'),
    },
  },
  async ({ paths, keyword, verbose }) => {
    const results = runPytest(paths, keyword, verbose ?? false);
    return {
      content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
    };
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
