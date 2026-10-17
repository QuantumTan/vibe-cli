import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  parsePrismaSchema,
  parseSqlSchema,
  generateMermaidErDiagram,
  formatDatabaseSchemaMarkdown,
} from '../src/commands/db.js';
import { minifySource, estimateTokens } from '../src/commands/pack.js';
import { synthesizeConventionalCommit } from '../src/commands/commit.js';
import { parseEnvKeys, detectLeakedSecret, syncEnvExample } from '../src/commands/env.js';
import { buildProjectCanvas } from '../src/commands/canvas.js';

describe('Package C: Database & Schema Visualizer (vibe db)', () => {
  it('parses Prisma schemas into tables and relational links', () => {
    const prisma = `
model User {
  id    String @id @default(uuid())
  email String @unique
  posts Post[]
}

model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}
`;
    const { tables, relations } = parsePrismaSchema(prisma);

    expect(tables.length).toBe(2);
    expect(tables[0].name).toBe('User');
    expect(tables[0].fields.some((f) => f.name === 'id' && f.isPk)).toBe(true);
    expect(relations.length).toBeGreaterThan(0);
    expect(relations.some((r) => r.fromTable === 'User' && r.toTable === 'Post')).toBe(true);

    const mermaid = generateMermaidErDiagram(tables, relations);
    expect(mermaid).toContain('erDiagram');
    expect(mermaid).toContain('User ||--o{ Post');
  });

  it('parses SQL CREATE TABLE DDL statements', () => {
    const sql = `
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP
);

CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id),
  total INT NOT NULL
);
`;
    const { tables, relations } = parseSqlSchema(sql);

    expect(tables.length).toBe(2);
    expect(tables.map((t) => t.name)).toContain('users');
    expect(tables.map((t) => t.name)).toContain('orders');
    expect(relations.some((r) => r.fromTable === 'orders' && r.toTable === 'users')).toBe(true);
  });
});

describe('Package C: Token-Optimized Context Packer (vibe pack)', () => {
  it('strips block and inline comments to reduce token weight', () => {
    const code = `
// Single line comment
/* Multi
   line
   comment */
export function add(a: number, b: number): number {
  // inner comment
  return a + b;
}
`;
    const minified = minifySource(code, false);
    expect(minified).not.toContain('Single line comment');
    expect(minified).not.toContain('Multi');
    expect(minified).toContain('export function add(a: number, b: number): number');
  });

  it('extracts signatures and interfaces only when requested', () => {
    const code = `
export interface UserPayload {
  id: string;
}

export function getUser(id: string): UserPayload {
  const query = "SELECT * FROM users";
  return { id };
}
`;
    const signatures = minifySource(code, true);
    expect(signatures).toContain('export interface UserPayload');
    expect(signatures).toContain('export function getUser(id: string): UserPayload;');
    expect(signatures).not.toContain('SELECT * FROM users');
  });

  it('estimates token count using standard ~4 char heuristic', () => {
    const text = '1234567890123456'; // 16 chars -> ~4 tokens
    expect(estimateTokens(text)).toBe(4);
  });
});

describe('Package C: Semantic Conventional Commit (vibe commit)', () => {
  it('proposes test type when all changed files are in tests/', () => {
    const proposal = synthesizeConventionalCommit({
      staged: true,
      filesChanged: ['tests/billing.test.ts'],
      insertions: 50,
      deletions: 0,
      rawDiff: '+ describe("billing", () => {})',
    });

    expect(proposal.type).toBe('test');
    expect(proposal.scope).toBe('billing');
    expect(proposal.fullMessage).toContain('test(billing):');
  });

  it('proposes feat with billing scope when modifying billing modules', () => {
    const proposal = synthesizeConventionalCommit({
      staged: true,
      filesChanged: ['src/billing/checkout.ts'],
      insertions: 80,
      deletions: 2,
      rawDiff: '+ export async function checkout() {}',
    });

    expect(proposal.type).toBe('feat');
    expect(proposal.scope).toBe('billing');
    expect(proposal.fullMessage).toContain('feat(billing):');
  });
});

describe('Package C: Environment Sentinel (vibe env)', () => {
  it('parses .env key-value pairs ignoring comments', () => {
    const env = `
# Server Port
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/db
`;
    const map = parseEnvKeys(env);
    expect(map['PORT']).toBe('3000');
    expect(map['DATABASE_URL']).toContain('postgresql://');
    expect(map['# Server Port']).toBeUndefined();
  });

  it('detects live secret signatures accurately', () => {
    const sampleStripeLive = ['sk', 'live', '1234567890abcdefghijklmnop'].join('_');
    const sampleGhp = ['ghp', '1234567890abcdefghijklmnopqrstuvwxyz'].join('_');
    const sampleAws = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
    expect(detectLeakedSecret(sampleStripeLive)).toBe(true);
    expect(detectLeakedSecret(sampleGhp)).toBe(true);
    expect(detectLeakedSecret(sampleAws)).toBe(true);
    expect(detectLeakedSecret('http://localhost:3000')).toBe(false);
    expect(detectLeakedSecret('your_secret_here')).toBe(false);
  });

  it('synchronizes missing keys from .env to .env.example with sanitized placeholders', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-env-test-'));

    await fs.writeFile(path.join(tempDir, '.env'), 'STRIPE_SECRET_KEY=sk_test_123\nAPI_PORT=4000\n', 'utf8');
    await fs.writeFile(path.join(tempDir, '.env.example'), 'API_PORT=4000\n', 'utf8');

    const result = await syncEnvExample(tempDir);
    expect(result.addedKeys).toContain('STRIPE_SECRET_KEY');

    const updatedExample = await fs.readFile(path.join(tempDir, '.env.example'), 'utf8');
    expect(updatedExample).toContain('STRIPE_SECRET_KEY=your_stripe_secret_key_here');

    await fs.remove(tempDir);
  });
});

describe('Package C: Native Obsidian Canvas Generator (vibe canvas)', () => {
  it('builds interactive visual canvas nodes and connective edges', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-canvas-test-'));
    await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'canvas-app' }), 'utf8');

    const canvas = await buildProjectCanvas(tempDir, 'CanvasApp', '02-Projects/CanvasApp');

    expect(canvas.nodes.length).toBeGreaterThanOrEqual(4);
    expect(canvas.edges.length).toBeGreaterThanOrEqual(3);

    const nodeIds = canvas.nodes.map((n) => n.id);
    expect(nodeIds).toContain('node_hub');
    expect(nodeIds).toContain('node_context');
    expect(nodeIds).toContain('node_arch');
    expect(nodeIds).toContain('node_db');

    await fs.remove(tempDir);
  });
});
