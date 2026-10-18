import path from 'path';
import fs from 'fs-extra';
import { VERIFIED_FREE_PROVIDERS, FreeModelSpec } from './free-providers.js';

export interface ProviderUsageState {
  requestsToday: number;
  tokensToday: number;
  lastRequestTime: number;
  cooldownUntil: number;
  remainingRequestsHeader?: number;
  remainingTokensHeader?: number;
  resetDate: string; // YYYY-MM-DD
}

export interface QuotaLedgerData {
  version: number;
  lastUpdated: string;
  providers: Record<string, ProviderUsageState>;
}

export function getLedgerFilePath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.vibe', 'quota-ledger.json');
}

/**
 * Returns YYYY-MM-DD for Pacific Time or UTC depending on provider reset policy.
 */
export function getCurrentDateString(resetRule: FreeModelSpec['resetRule'] = 'rolling'): string {
  const now = new Date();
  if (resetRule === 'midnight_us_pacific') {
    // US Pacific is UTC-7 or UTC-8
    const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    return pacific.toISOString().substring(0, 10);
  }
  return now.toISOString().substring(0, 10);
}

/**
 * Loads quota ledger atomically from disk, initializing missing providers.
 */
export async function loadQuotaLedger(cwd: string = process.cwd()): Promise<QuotaLedgerData> {
  const filePath = getLedgerFilePath(cwd);
  let data: QuotaLedgerData = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    providers: {},
  };

  if (await fs.pathExists(filePath)) {
    try {
      data = await fs.readJson(filePath);
    } catch {
      // Return fresh on corrupt JSON
    }
  }

  // Ensure all verified providers exist in state and handle daily reset
  for (const [key, spec] of Object.entries(VERIFIED_FREE_PROVIDERS)) {
    const today = getCurrentDateString(spec.resetRule);
    if (!data.providers[key]) {
      data.providers[key] = {
        requestsToday: 0,
        tokensToday: 0,
        lastRequestTime: 0,
        cooldownUntil: 0,
        resetDate: today,
      };
    } else {
      const pState = data.providers[key];
      // Daily rollover
      if (pState.resetDate !== today && spec.resetRule !== 'none') {
        pState.requestsToday = 0;
        pState.tokensToday = 0;
        pState.resetDate = today;
        pState.cooldownUntil = 0;
      }
    }
  }

  return data;
}

/**
 * Saves quota ledger to .vibe/quota-ledger.json
 */
export async function saveQuotaLedger(data: QuotaLedgerData, cwd: string = process.cwd()): Promise<void> {
  const filePath = getLedgerFilePath(cwd);
  await fs.ensureDir(path.dirname(filePath));
  data.lastUpdated = new Date().toISOString();
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/**
 * Records usage (requests and tokens) for a given provider.
 */
export async function recordUsage(
  providerKey: string,
  tokensIn: number,
  tokensOut: number,
  cwd: string = process.cwd()
): Promise<void> {
  const ledger = await loadQuotaLedger(cwd);
  if (!ledger.providers[providerKey]) {
    ledger.providers[providerKey] = {
      requestsToday: 0,
      tokensToday: 0,
      lastRequestTime: 0,
      cooldownUntil: 0,
      resetDate: getCurrentDateString(),
    };
  }

  const pState = ledger.providers[providerKey];
  pState.requestsToday += 1;
  pState.tokensToday += tokensIn + tokensOut;
  pState.lastRequestTime = Date.now();

  await saveQuotaLedger(ledger, cwd);
}

/**
 * Parses HTTP headers (x-ratelimit-*, retry-after) and applies cooldowns.
 */
export async function handleRateLimitHeaders(
  providerKey: string,
  statusCode: number,
  headers: Record<string, string | string[] | undefined> = {},
  cwd: string = process.cwd()
): Promise<{ inCooldown: boolean; cooldownSeconds: number }> {
  const ledger = await loadQuotaLedger(cwd);
  const pState = ledger.providers[providerKey] || {
    requestsToday: 0,
    tokensToday: 0,
    lastRequestTime: 0,
    cooldownUntil: 0,
    resetDate: getCurrentDateString(),
  };

  // Header extraction (case-insensitive lookup)
  const getHeader = (name: string): string | undefined => {
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) {
        return Array.isArray(v) ? v[0] : v;
      }
    }
    return undefined;
  };

  const remainingReq = getHeader('x-ratelimit-remaining-requests');
  if (remainingReq) {
    pState.remainingRequestsHeader = parseInt(remainingReq, 10);
  }

  const remainingTokens = getHeader('x-ratelimit-remaining-tokens');
  if (remainingTokens) {
    pState.remainingTokensHeader = parseInt(remainingTokens, 10);
  }

  let cooldownSeconds = 0;
  if (statusCode === 429) {
    const retryAfter = getHeader('retry-after');
    cooldownSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
    if (isNaN(cooldownSeconds) || cooldownSeconds <= 0) {
      cooldownSeconds = 60;
    }
    pState.cooldownUntil = Date.now() + cooldownSeconds * 1000;
  }

  ledger.providers[providerKey] = pState;
  await saveQuotaLedger(ledger, cwd);

  return {
    inCooldown: pState.cooldownUntil > Date.now(),
    cooldownSeconds,
  };
}

/**
 * Selects an optimal free provider according to token ceilings, quotas, and cooldowns.
 */
export async function selectOptimalProvider(
  estimatedTokens: number,
  options: { preferredProvider?: string; cwd?: string } = {}
): Promise<{ selectedKey: string; spec: FreeModelSpec; reason: string }> {
  const ledger = await loadQuotaLedger(options.cwd || process.cwd());
  const now = Date.now();

  const candidates = Object.entries(VERIFIED_FREE_PROVIDERS);

  // If specific preferred provider requested, test it first
  if (options.preferredProvider && VERIFIED_FREE_PROVIDERS[options.preferredProvider]) {
    const key = options.preferredProvider;
    const spec = VERIFIED_FREE_PROVIDERS[key];
    const pState = ledger.providers[key];

    const isCooldown = pState && pState.cooldownUntil > now;
    const isExhausted = pState && pState.requestsToday >= spec.rpd;
    const exceedsInput = spec.maxInputTokens && estimatedTokens > spec.maxInputTokens;

    if (!isCooldown && !isExhausted && !exceedsInput) {
      return {
        selectedKey: key,
        spec,
        reason: `Preferred provider ${spec.name} is available (${spec.rpd - (pState?.requestsToday || 0)} requests remaining).`,
      };
    }
  }

  // Pre-flight priority order:
  // 1. Groq (if prompt <= 6000 tokens)
  // 2. GitHub Models (if prompt <= 8000 tokens)
  // 3. Gemini Free (large context up to 1M tokens)
  // 4. OpenRouter Free
  // 5. Cloudflare Workers AI
  // 6. Local Ollama (unlimited fallback)

  const priorityOrder = [
    'groq-llama-8b',
    'groq-llama-70b',
    'groq-qwen-27b',
    'github-models',
    'gemini-flash',
    'openrouter-free',
    'cloudflare-workers-ai',
    'local-ollama',
    'local-lmstudio',
  ];

  for (const key of priorityOrder) {
    const spec = VERIFIED_FREE_PROVIDERS[key];
    if (!spec) continue;

    const pState = ledger.providers[key];

    // Rule: if tokens > 6000, skip groq-8b
    if (key === 'groq-llama-8b' && estimatedTokens > 6000) {
      continue;
    }

    // Rule: if tokens > 8000, skip github-models
    if (key === 'github-models' && estimatedTokens > 8000) {
      continue;
    }

    // Check provider-specific input ceiling
    if (spec.maxInputTokens && estimatedTokens > spec.maxInputTokens) {
      continue;
    }

    // Check cooldown
    if (pState && pState.cooldownUntil > now) {
      continue;
    }

    // Check daily RPD
    if (pState && pState.requestsToday >= spec.rpd) {
      continue;
    }

    const remainingRpd = spec.rpd - (pState ? pState.requestsToday : 0);
    return {
      selectedKey: key,
      spec,
      reason: `Routed to ${spec.name}: input tokens (~${estimatedTokens}) within limits, ${remainingRpd} daily requests remaining.`,
    };
  }

  // Ultimate fallback to local ollama
  const fallbackSpec = VERIFIED_FREE_PROVIDERS['local-ollama'];
  return {
    selectedKey: 'local-ollama',
    spec: fallbackSpec,
    reason: `All cloud free tiers exhausted or input tokens (~${estimatedTokens}) exceed limits. Falling back to Local Ollama.`,
  };
}

/**
 * Generates formatted terminal table of remaining daily quota.
 */
export async function getQuotaReport(cwd: string = process.cwd()): Promise<string> {
  const ledger = await loadQuotaLedger(cwd);
  const now = Date.now();

  const lines: string[] = [];
  lines.push(`+-----------------------+--------------------------+----------+------------+----------------+`);
  lines.push(`| Provider              | Model                    | RPM/TPM  | Used/Daily | Status         |`);
  lines.push(`+-----------------------+--------------------------+----------+------------+----------------+`);

  for (const [key, spec] of Object.entries(VERIFIED_FREE_PROVIDERS)) {
    const pState = ledger.providers[key] || {
      requestsToday: 0,
      tokensToday: 0,
      lastRequestTime: 0,
      cooldownUntil: 0,
      resetDate: getCurrentDateString(),
    };

    const isCooldown = pState.cooldownUntil > now;
    const cooldownSec = isCooldown ? Math.ceil((pState.cooldownUntil - now) / 1000) : 0;
    const isExhausted = pState.requestsToday >= spec.rpd;

    let status = 'Ready';
    if (isCooldown) {
      status = `Cooldown (${cooldownSec}s)`;
    } else if (isExhausted) {
      status = 'Exhausted (Daily)';
    }

    const providerCol = spec.provider.padEnd(21, ' ').substring(0, 21);
    const modelCol = spec.name.padEnd(24, ' ').substring(0, 24);
    const rateCol = `${spec.rpm}R/${Math.round(spec.tpm / 1000)}k`.padEnd(8, ' ').substring(0, 8);
    const usedCol = `${pState.requestsToday}/${spec.rpd}`.padEnd(10, ' ').substring(0, 10);
    const statusCol = status.padEnd(14, ' ').substring(0, 14);

    lines.push(`| ${providerCol} | ${modelCol} | ${rateCol} | ${usedCol} | ${statusCol} |`);
  }

  lines.push(`+-----------------------+--------------------------+----------+------------+----------------+`);
  return lines.join('\n');
}
