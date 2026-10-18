import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import {
  loadQuotaLedger,
  saveQuotaLedger,
  recordUsage,
  handleRateLimitHeaders,
  selectOptimalProvider,
  getQuotaReport,
} from '../src/core/quota-ledger.js';
import { VERIFIED_FREE_PROVIDERS } from '../src/core/free-providers.js';

describe('Zero-Dollar Quota Ledger & Pre-Flight Failover', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-quota-test-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('initializes and persists all verified free providers in .vibe/quota-ledger.json', async () => {
    const ledger = await loadQuotaLedger(tmpDir);
    expect(ledger.version).toBe(1);
    expect(ledger.providers['groq-llama-8b']).toBeDefined();
    expect(ledger.providers['gemini-flash']).toBeDefined();
    expect(ledger.providers['github-models']).toBeDefined();

    const ledgerPath = path.join(tmpDir, '.vibe', 'quota-ledger.json');
    await saveQuotaLedger(ledger, tmpDir);
    expect(await fs.pathExists(ledgerPath)).toBe(true);
  });

  it('records request count and tokens used', async () => {
    await recordUsage('groq-llama-8b', 1200, 300, tmpDir);
    const ledger = await loadQuotaLedger(tmpDir);

    expect(ledger.providers['groq-llama-8b'].requestsToday).toBe(1);
    expect(ledger.providers['groq-llama-8b'].tokensToday).toBe(1500);
  });

  it('skips groq-llama-8b when input tokens exceed 6000 TPM limit', async () => {
    const routeSmall = await selectOptimalProvider(2000, { cwd: tmpDir });
    expect(routeSmall.selectedKey).toBe('groq-llama-8b');

    // 6500 tokens should bypass groq-8b (cap is 6000)
    const routeLarge = await selectOptimalProvider(6500, { cwd: tmpDir });
    expect(routeLarge.selectedKey).not.toBe('groq-llama-8b');
    expect(['groq-llama-70b', 'groq-qwen-27b', 'github-models', 'gemini-flash']).toContain(routeLarge.selectedKey);
  });

  it('skips github-models when input tokens exceed 8000 cap and routes to gemini-flash', async () => {
    // 8500 tokens exceeds Groq (8k max) and GitHub Models (8k cap) -> routes to Gemini Flash
    const routeHuge = await selectOptimalProvider(8500, { cwd: tmpDir });
    expect(routeHuge.selectedKey).toBe('gemini-flash');
    expect(routeHuge.reason).toContain('Gemini 2.5 Flash');
  });

  it('activates cooldown on HTTP 429 and parses retry-after header', async () => {
    const headers = {
      'x-ratelimit-remaining-requests': '0',
      'retry-after': '30',
    };

    const status = await handleRateLimitHeaders('groq-llama-8b', 429, headers, tmpDir);
    expect(status.inCooldown).toBe(true);
    expect(status.cooldownSeconds).toBe(30);

    const ledger = await loadQuotaLedger(tmpDir);
    expect(ledger.providers['groq-llama-8b'].cooldownUntil).toBeGreaterThan(Date.now());

    // When groq-8b is in cooldown, optimal provider should automatically fail over to groq-70b or next
    const failover = await selectOptimalProvider(1000, { cwd: tmpDir });
    expect(failover.selectedKey).not.toBe('groq-llama-8b');
    expect(failover.selectedKey).toBe('groq-llama-70b');
  });

  it('generates formatted terminal table of remaining daily quota', async () => {
    const report = await getQuotaReport(tmpDir);
    expect(report).toContain('Provider');
    expect(report).toContain('Model');
    expect(report).toContain('gemini-free');
    expect(report).toContain('groq-free');
    expect(report).toContain('Ready');
  });
});
