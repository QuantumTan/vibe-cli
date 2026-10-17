import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { matchIntentToTools, DiscoveredTool } from '../src/skills/omniroute.js';
import { generateArchitectPrdMarkdown } from '../src/commands/clarify.js';
import { scaffoldLegalSuite, scaffoldDockerAndCI } from '../src/commands/ship.js';

describe('Package A: OmniRoute Intent Dispatcher', () => {
  const sampleTools: DiscoveredTool[] = [
    {
      skillName: 'db-cleaner',
      toolName: 'purge_cache',
      description: 'Purge stale redis cache keys and flush buffer',
      riskLevel: 'destructive_write',
      runnerPath: '/fake/run.js',
      runnerType: 'node',
      parameters: {},
      required: [],
    },
    {
      skillName: 'stripe-billing',
      toolName: 'create_checkout_session',
      description: 'Generate Stripe customer checkout session url',
      riskLevel: 'idempotent_write',
      runnerPath: '/fake/stripe.js',
      runnerType: 'node',
      parameters: {},
      required: [],
    },
    {
      skillName: 'system-monitor',
      toolName: 'get_metrics',
      description: 'Fetch cpu and memory telemetry',
      riskLevel: 'read_only',
      runnerPath: '/fake/monitor.py',
      runnerType: 'python',
      parameters: {},
      required: [],
    },
  ];

  it('matches intent to the most relevant tool with high confidence', () => {
    const matches = matchIntentToTools('Please purge the cache and flush memory', sampleTools);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].tool.toolName).toBe('purge_cache');
    expect(matches[0].confidence).toBe('high');
  });

  it('extracts parameters like URLs and integer limits from intent', () => {
    const matches = matchIntentToTools('Fetch Stripe session for https://myapp.com/success limit 50', sampleTools);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].tool.skillName).toBe('stripe-billing');
    expect(matches[0].extractedParams['url']).toBe('https://myapp.com/success');
    expect(matches[0].extractedParams['limit']).toBe(50);
  });

  it('returns empty array when intent has zero token overlap', () => {
    const matches = matchIntentToTools('astrophysics black hole calculation', sampleTools);
    expect(matches).toEqual([]);
  });
});

describe('Package A: Principal Architect Interview (vibe clarify)', () => {
  it('generates locked architectural PRD markdown with contracts and anti-slop directives', () => {
    const prd = generateArchitectPrdMarkdown('Stripe Subscriptions', 'OmniSaaS', {
      persistence: 'PostgreSQL with Prisma ACID transactions',
      auth: 'Role-Based Access Control (RBAC with admin, member, owner)',
      resilience: 'Atomic transactional rollback',
      latency: 'Real-time synchronous response (< 100ms)',
      commercial: 'Usage metering with Stripe webhooks',
    });

    expect(prd).toContain('# Production PRD: Stripe Subscriptions');
    expect(prd).toContain('**Project**: OmniSaaS');
    expect(prd).toContain('PostgreSQL with Prisma ACID transactions');
    expect(prd).toContain('Role-Based Access Control (RBAC with admin, member, owner)');
    expect(prd).toContain('Atomic transactional rollback');
    expect(prd).toContain('export interface StripeSubscriptionsPayload');
    expect(prd).toContain('Anti-Slop Implementation Directives');
  });
});

describe('Package A: Commercial Launch Gate (vibe ship)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-ship-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  it('scaffolds GDPR Privacy Policy and Terms of Service idempotently', async () => {
    const legalDir = path.join(tempDir, 'legal');
    const created = await scaffoldLegalSuite(legalDir, 'AcmeApp');

    expect(created).toContain('Privacy-Policy.md');
    expect(created).toContain('Terms-of-Service.md');

    const privacyContent = await fs.readFile(path.join(legalDir, 'Privacy-Policy.md'), 'utf8');
    expect(privacyContent).toContain('# Privacy Policy for AcmeApp');
    expect(privacyContent).toContain('GDPR Rights');

    // Run again to verify idempotency (should not overwrite or re-create)
    const reCreated = await scaffoldLegalSuite(legalDir, 'AcmeApp');
    expect(reCreated).toHaveLength(0);
  });

  it('scaffolds production Dockerfile and GitHub Actions CI workflow', async () => {
    const created = await scaffoldDockerAndCI(tempDir, ['TypeScript', 'React']);

    expect(created).toContain('Dockerfile');
    expect(created).toContain('.dockerignore');
    expect(created).toContain('.github/workflows/ci.yml');

    const dockerfile = await fs.readFile(path.join(tempDir, 'Dockerfile'), 'utf8');
    expect(dockerfile).toContain('FROM node:20-alpine AS builder');
    expect(dockerfile).toContain('FROM node:20-alpine AS runner');

    const ciWorkflow = await fs.readFile(path.join(tempDir, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(ciWorkflow).toContain('name: Build & Verify');
    expect(ciWorkflow).toContain('npm test');
  });
});
