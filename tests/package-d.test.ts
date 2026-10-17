import { describe, it, expect } from 'vitest';
import { parseErrorTrace, generateSurgicalPrompt } from '../src/commands/triage.js';
import {
  normalizeOpenApiPath,
  buildOpenApiSpec,
  formatApiReferenceMarkdown,
} from '../src/commands/api.js';
import { auditDependencies } from '../src/commands/deps.js';

describe('Package D: AI Failure Triage & Self-Healing (vibe triage)', () => {
  it('parses TypeScript compiler errors from trace output', () => {
    const errorLog = `
src/services/billing.ts:42:10 - error TS2304: Cannot find name 'stripeSecret'.
src/index.ts(15,20): error TS2339: Property 'run' does not exist on type 'App'.
`;
    const findings = parseErrorTrace(errorLog);
    expect(findings.length).toBe(2);
    expect(findings[0].file).toBe('src/services/billing.ts');
    expect(findings[0].line).toBe(42);
    expect(findings[0].message).toContain('stripeSecret');

    expect(findings[1].file).toBe('src/index.ts');
    expect(findings[1].line).toBe(15);
  });

  it('parses Vitest test failure traces', () => {
    const vitestOutput = `
FAIL  tests/auth.test.ts > Authentication Suite > logs in user with valid JWT
AssertionError: expected false to be true
    at tests/auth.test.ts:35:20
`;
    const findings = parseErrorTrace(vitestOutput);
    expect(findings.some((f) => f.file.includes('tests/auth.test.ts'))).toBe(true);
  });

  it('generates a strict surgical fix prompt for AI agents', () => {
    const prompt = generateSurgicalPrompt(
      'npm test',
      'AssertionError: Expected 200 but received 401',
      [{ file: 'src/routes/auth.ts', line: 25, message: 'Unauthorized header missing' }],
      '24: export function auth() {\n25:   throw new Error("Unauthorized");\n26: }',
      'Gotcha: Always include Bearer prefix'
    );

    expect(prompt).toContain('# 🚨 SURGICAL ERROR RECOVERY DIRECTIVE');
    expect(prompt).toContain('`npm test`');
    expect(prompt).toContain('src/routes/auth.ts');
    expect(prompt).toContain('Line 25');
    expect(prompt).toContain('Offending Source Code Context');
    expect(prompt).toContain('Gotcha: Always include Bearer prefix');
    expect(prompt).toContain('Strict Anti-Slop Fix Directives');
  });
});

describe('Package D: OpenAPI 3.0 Exporter (vibe api)', () => {
  it('normalizes parameter syntax from express colon to openapi brackets', () => {
    const { path, pathParams } = normalizeOpenApiPath('/api/users/:userId/orders/:orderId');
    expect(path).toBe('/api/users/{userId}/orders/{orderId}');
    expect(pathParams).toEqual(['userId', 'orderId']);
  });

  it('synthesizes standard OpenAPI 3.0.3 schema object', () => {
    const spec = buildOpenApiSpec('OmniSaaS', [
      { method: 'GET', path: '/api/users', handler: 'users.ts', file: 'users.ts' },
      { method: 'POST', path: '/api/checkout', handler: 'billing.ts', file: 'billing.ts' },
    ]);

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('OmniSaaS API');
    expect(spec.paths['/api/users']).toBeDefined();
    expect(spec.paths['/api/users']['get']).toBeDefined();
    expect(spec.paths['/api/checkout']['post']).toBeDefined();
    expect(spec.paths['/api/checkout']['post'].requestBody).toBeDefined();
  });

  it('formats markdown API reference with ready-to-run curl snippets', () => {
    const md = formatApiReferenceMarkdown('TestApp', [
      { method: 'GET', path: '/api/health', handler: 'health.ts', file: 'health.ts' },
      { method: 'POST', path: '/api/users', handler: 'users.ts', file: 'users.ts' },
    ]);

    expect(md).toContain('# API Reference & Endpoint Catalog: TestApp');
    expect(md).toContain('### `GET` `/api/health`');
    expect(md).toContain('curl -X GET "http://localhost:3000/api/health"');
    expect(md).toContain('curl -X POST "http://localhost:3000/api/users"');
  });
});

describe('Package D: Dependency & Supply-Chain Auditor (vibe deps)', () => {
  it('audits package manifest dependencies and ecosystem', async () => {
    const report = await auditDependencies(process.cwd(), { skipNetwork: true });
    expect(report.ecosystem).toBe('npm');
    expect(report.manifestPath).toBe('package.json');
    expect(report.totalDependencies).toBeGreaterThan(0);
  });
});
