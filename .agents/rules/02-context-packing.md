---
trigger: model_decision
description: Load when editing AST token-shaking, context packing, token estimation, diff extraction, or SHA-256 caching.
globs:
  - "src/commands/pack.ts"
  - "src/core/ast-packer.ts"
  - "src/utils/token-estimator.ts"
---

# Rule 02: Budget-Capped Context Packing & AST Caching

## Token Estimation (`src/utils/token-estimator.ts`)
Never bundle WASM/native tokenizers. Estimate token count synchronously as:
$$T_{\text{est}} = \left\lceil \frac{\text{charCount}}{3.6} + 0.15 \times \text{punctuationCount} \right\rceil$$

## Tiered Budget Allocation (`vibe pack --budget <B>`)
Given a total budget $B$ (default $B = 4000$ tokens):
- **Tier 1 ($0.50 \times B$): Active Diffs & Error Frames**
  - Include `git diff --unified=3 HEAD` hunks.
  - If `--error-log` is provided, parse file paths and line numbers (Node/TS, PHP, C#, Python formats) and include $\pm 20$ lines around each frame.
- **Tier 2 ($0.30 \times B$): Cached AST Signatures**
  - Extract only exported types, interfaces, class headers, and function signatures of direct imports.
  - Lookup SHA-256 digest (`node:crypto`) of each file in `.vibe/cache/ast-signatures.json` for $\mathcal{O}(1)$ reuse on unchanged files.
- **Tier 3 ($0.20 \times B$): Project Map & Core Rules**
  - Compact directory tree (excluding `node_modules`, `dist`, `.git`, `.vibe/cache`) + root `AGENTS.md`.

## Deterministic Compression (`--compress`)
Strip non-JSDoc comments, collapse $\ge 2$ consecutive blank lines into 1, and deduplicate identical stack trace frames before serializing output.
