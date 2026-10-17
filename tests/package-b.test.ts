import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import http from 'http';
import {
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
} from '../src/commands/checkpoint.js';
import {
  analyzeSourceFile,
  extractApiRoutes,
  formatCodebaseMapMarkdown,
} from '../src/commands/map.js';
import {
  generateCheckoutRouteSource,
  generateWebhookRouteSource,
  generatePricingTableComponentSource,
  scaffoldMonetizationSuite,
} from '../src/commands/monetize.js';
import { createMockServer } from '../src/commands/mock.js';

describe('Package B: Checkpoint & Rollback Engine', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-cp-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('creates and lists workspace checkpoints with snapshot files', async () => {
    // Setup mock file
    const sampleFile = path.join(tempDir, 'package.json');
    await fs.writeFile(sampleFile, JSON.stringify({ name: 'test-app', version: '1.0.0' }), 'utf8');

    const manifest = await createCheckpoint(tempDir, 'Initial State');

    expect(manifest.id).toMatch(/^cp_\d+$/);
    expect(manifest.label).toBe('Initial State');
    expect(manifest.fileCount).toBeGreaterThanOrEqual(1);
    expect(manifest.files['package.json']).toContain('test-app');

    const list = await listCheckpoints(tempDir);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(manifest.id);
  });

  it('restores workspace files to exact snapshot state', async () => {
    const testFile = path.join(tempDir, 'package.json');
    await fs.writeFile(testFile, JSON.stringify({ version: '1.0.0' }), 'utf8');

    const cp = await createCheckpoint(tempDir, 'Stable');

    // Simulate agent corrupting or changing the file
    await fs.writeFile(testFile, JSON.stringify({ version: '2.0.0-BROKEN' }), 'utf8');
    expect(await fs.readFile(testFile, 'utf8')).toContain('2.0.0-BROKEN');

    // Rollback
    const result = await restoreCheckpoint(tempDir, cp.id);
    expect(result.success).toBe(true);
    expect(result.restoredCount).toBeGreaterThanOrEqual(1);

    // Verify restored content
    const restoredContent = await fs.readFile(testFile, 'utf8');
    expect(restoredContent).toContain('1.0.0');
    expect(restoredContent).not.toContain('2.0.0-BROKEN');
  });

  it('handles non-existent checkpoint gracefully', async () => {
    const result = await restoreCheckpoint(tempDir, 'cp_nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('Package B: Codebase Topology & AST Grapher (vibe map)', () => {
  it('extracts exported symbols and relative dependencies from source code', () => {
    const tsCode = `
import { helper } from './utils.js';
import pc from 'picocolors';

export function calculateTotal(price: number): number {
  return price * 1.2;
}

export class OrderService {
  process() {}
}

export interface OrderItem {
  id: string;
  qty: number;
}

export type OrderStatus = 'pending' | 'completed';
`;

    const moduleNode = analyzeSourceFile('src/services/order.ts', tsCode);

    expect(moduleNode.file).toBe('src/services/order.ts');
    expect(moduleNode.symbols.map((s) => s.name)).toEqual([
      'calculateTotal',
      'OrderService',
      'OrderItem',
      'OrderStatus',
    ]);
    expect(moduleNode.dependencies).toContain('src/services/utils.js');
  });

  it('extracts API routes across Express, Next.js, and Python', () => {
    const expressCode = `
app.get('/api/users', getUsers);
router.post('/api/checkout', processCheckout);
`;
    const expressRoutes = extractApiRoutes('server.js', expressCode);
    expect(expressRoutes).toHaveLength(2);
    expect(expressRoutes[0].method).toBe('GET');
    expect(expressRoutes[0].path).toBe('/api/users');
    expect(expressRoutes[1].method).toBe('POST');
    expect(expressRoutes[1].path).toBe('/api/checkout');

    const nextCode = `
export async function GET(req: Request) { return Response.json({}); }
export async function POST(req: Request) { return Response.json({}); }
`;
    const nextRoutes = extractApiRoutes('src/app/api/billing/route.ts', nextCode);
    expect(nextRoutes.length).toBeGreaterThanOrEqual(2);
    expect(nextRoutes.some((r) => r.method === 'GET')).toBe(true);
    expect(nextRoutes.some((r) => r.method === 'POST')).toBe(true);
  });

  it('formats markdown with Mermaid diagram and symbol catalog', () => {
    const md = formatCodebaseMapMarkdown('TestApp', {
      totalFiles: 2,
      totalSymbols: 3,
      modules: [
        {
          file: 'src/app.ts',
          symbols: [{ name: 'start', kind: 'function', file: 'src/app.ts', line: 1 }],
          dependencies: ['src/db.ts'],
        },
      ],
      routes: [{ method: 'GET', path: '/api/items', handler: 'itemsHandler', file: 'src/routes.ts' }],
      mermaidGraph: 'flowchart TD\n  src_app_ts --> src_db_ts',
    });

    expect(md).toContain('# Codebase Topology & Architecture Map: TestApp');
    expect(md).toContain('```mermaid');
    expect(md).toContain('flowchart TD');
    expect(md).toContain('| `GET` | `/api/items` | `[[src/routes.ts]]` |');
    expect(md).toContain('`start` (function)');
  });
});

describe('Package B: Commercial Monetization Suite (vibe monetize)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-monetize-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('generates valid Next.js App Router and Express checkout route templates', () => {
    const nextCheckout = generateCheckoutRouteSource(true);
    expect(nextCheckout).toContain('NextRequest, NextResponse');
    expect(nextCheckout).toContain('stripe.checkout.sessions.create');
    expect(nextCheckout).toContain("mode: 'subscription'");

    const expressCheckout = generateCheckoutRouteSource(false);
    expect(expressCheckout).toContain('Request, Response');
    expect(expressCheckout).toContain('stripe.checkout.sessions.create');
  });

  it('generates cryptographic webhook verifier with idempotency events', () => {
    const webhook = generateWebhookRouteSource(true);
    expect(webhook).toContain('stripe.webhooks.constructEvent');
    expect(webhook).toContain("case 'checkout.session.completed':");
    expect(webhook).toContain("case 'customer.subscription.deleted':");
  });

  it('generates React pricing table component with tier matrices', () => {
    const component = generatePricingTableComponentSource();
    expect(component).toContain('export function PricingTable()');
    expect(component).toContain('PRICING_PLANS');
    expect(component).toContain('Starter');
    expect(component).toContain('Pro');
    expect(component).toContain('Enterprise');
  });

  it('scaffolds complete monetization suite into filesystem', async () => {
    await fs.ensureDir(path.join(tempDir, 'src'));
    const result = await scaffoldMonetizationSuite(tempDir);

    expect(result.createdFiles.length).toBeGreaterThanOrEqual(4);
    expect(result.envUpdated).toBe(true);

    const envContent = await fs.readFile(path.join(tempDir, '.env.example'), 'utf8');
    expect(envContent).toContain('STRIPE_SECRET_KEY');
    expect(envContent).toContain('STRIPE_WEBHOOK_SECRET');
  });
});

describe('Package B: Instant Mock REST API Server (vibe mock)', () => {
  let serverInstance: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    const { server } = createMockServer({ silent: true });
    serverInstance = server;

    await new Promise<void>((resolve) => {
      // Pick random available port
      serverInstance.listen(0, () => {
        const addr = serverInstance.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
  });

  it('serves health check endpoint with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.mock).toBe(true);
  });

  it('supports full CRUD cycle on mock collections', async () => {
    // 1. GET /api/users
    const getRes = await fetch(`${baseUrl}/api/users`);
    expect(getRes.status).toBe(200);
    const users = await getRes.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(2);

    // 2. POST /api/users
    const postRes = await fetch(`${baseUrl}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam Taylor', email: 'sam@example.com', role: 'engineer' }),
    });
    expect(postRes.status).toBe(201);
    const createdUser = await postRes.json();
    expect(createdUser.id).toBeDefined();
    expect(createdUser.name).toBe('Sam Taylor');

    // 3. PUT /api/users/:id
    const putRes = await fetch(`${baseUrl}/api/users/${createdUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'principal_engineer' }),
    });
    expect(putRes.status).toBe(200);
    const updatedUser = await putRes.json();
    expect(updatedUser.role).toBe('principal_engineer');

    // 4. DELETE /api/users/:id
    const delRes = await fetch(`${baseUrl}/api/users/${createdUser.id}`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.deleted).toBe(true);
  });

  it('handles CORS preflight OPTIONS requests cleanly', async () => {
    const optionsRes = await fetch(`${baseUrl}/api/users`, {
      method: 'OPTIONS',
    });
    expect(optionsRes.status).toBe(204);
    expect(optionsRes.headers.get('access-control-allow-origin')).toBe('*');
    expect(optionsRes.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
