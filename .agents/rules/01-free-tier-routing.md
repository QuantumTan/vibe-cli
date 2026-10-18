---
trigger: model_decision
description: Load when editing quota tracking, model routing, API failover, rate-limit headers, or free provider configurations.
globs:
  - "src/core/quota-ledger.ts"
  - "src/core/free-providers.ts"
  - "src/commands/route.ts"
  - "src/commands/quota.ts"
---

# Rule 01: Zero-Dollar Quota Ledger & Provider Failover

## Verified 2026 Free-Tier Ceilings
Persist all runtime counters atomically in `.vibe/quota-ledger.json`:
- **groq-free**:
  - `llama-3.1-8b-instant`: $30$ RPM, $6000$ TPM, $14400$ RPD.
  - `llama-3.3-70b-versatile`: $30$ RPM, $12000$ TPM, $1000$ RPD.
  - `qwen/qwen3.6-27b`: $30$ RPM, $8000$ TPM, $1000$ RPD.
- **gemini-free** (Google AI Studio):
  - `gemini-2.5-flash` / `gemini-3-flash`: $10$ RPM, $250000$ TPM, $250$–$1500$ RPD (resets Midnight US Pacific Time).
- **github-models** (PAT Auth):
  - Low tier: $15$ RPM, $150$ RPD. High tier: $10$ RPM, $50$ RPD.
  - Hard Request Cap: $\le 8000$ input tokens and $\le 4000$ output tokens.
- **openrouter-free** (`:free` models): $20$ RPM, $50$ RPD (\$0 balance).
- **cloudflare-workers-ai**: $10000$ Neurons/day (resets 00:00 UTC).
- **local-ollama / local-lmstudio**: Unlimited offline fallback (`localhost:11434/v1` or `localhost:1234/v1`).

## Pre-Flight Routing Invariants
- Estimate input tokens $T_{\text{in}}$ before every dispatch:
  - If $T_{\text{in}} > 5500$, bypass `groq-free` ($8\text{B}$) to prevent immediate TPM exhaustion.
  - If $T_{\text{in}} > 7800$, bypass `github-models` to avoid HTTP 413/400 errors and route to `gemini-free` or `local-ollama`.
- Parse `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, and `retry-after` headers on every response.
- Mark any provider returning HTTP 429 as `cooldownUntil = Date.now() + retryAfterMs`.
- Always strip `.env` values and high-entropy secrets before sending context to free cloud endpoints.
