import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { runProductionAudit } from '../src/commands/audit.js';

describe('Production Audit & Commercial Readiness Engine', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-audit-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('fails security when .env is not ignored in .gitignore', async () => {
    fs.writeJsonSync(path.join(tmpDir, 'package.json'), { name: 'unsecured-app' });
    const report = await runProductionAudit(tmpDir);

    const secretFinding = report.findings.find((f) => f.title.includes('Exposed Secrets Risk'));
    expect(secretFinding).toBeDefined();
    expect(secretFinding?.status).toBe('fail');
  });

  it('passes security when .env is properly ignored and .env.example exists', async () => {
    fs.writeJsonSync(path.join(tmpDir, 'package.json'), { name: 'secured-app' });
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '.env\nnode_modules/\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '.env.example'), 'STRIPE_KEY=your_key\n', 'utf-8');

    const report = await runProductionAudit(tmpDir);
    const envFinding = report.findings.find((f) => f.title.includes('Environment Variables Shielded'));
    expect(envFinding?.status).toBe('pass');
  });

  it('detects Stripe payment infrastructure', async () => {
    fs.writeJsonSync(path.join(tmpDir, 'package.json'), {
      name: 'profitable-app',
      dependencies: {
        stripe: '^14.0.0',
        '@clerk/nextjs': '^4.0.0',
      },
    });

    const report = await runProductionAudit(tmpDir);
    const payFinding = report.findings.find((f) => f.title.includes('Payment Gateway Integrated'));
    expect(payFinding?.status).toBe('pass');

    const authFinding = report.findings.find((f) => f.title.includes('Authentication System Configured'));
    expect(authFinding?.status).toBe('pass');
  });
});
