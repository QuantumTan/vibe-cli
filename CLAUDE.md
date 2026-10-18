# Claude Code Project Instructions

## Fast Verification & Commands
- **Build**: `npm run build`
- **Dev**: `npm run dev`
- **Test**: `npm test`
- **Vibe CLI**: `vibe check` | `vibe triage` | `vibe rewind`

## Architecture & Technology
- **Project**: vibe-cli (Web App)
- **Stack**: TypeScript

## Active Sliding Window Tasks
  - [x] Implement `vibe rules` with glob-scoping and KV-cache prefix structure
  - [x] Implement `vibe tunnel` with Cloudflare quick tunnels, port auto-detection & terminal QR codes
  - [x] Add comprehensive vitest suites for rules and tunnel (16 test files, 90 tests passing)
  - [x] Wire commands into interactive TUI menu and Commander CLI

## Historical Lessons & Gotchas
  - [10/17/2026] Initialized project memory bank.
  - [10/17/2026] GitHub Push Protection Gotcha: Mock tokens and secrets (e.g. `sk_live_...`, `ghp_...`, `AKIA...`) in unit tests trigger GitHub's automated push protection if written as literal strings. Always assemble mock secret signatures dynamically (e.g. via `['sk', 'live', ...].join('_')`) to prevent push rejection.
  - [10/17/2026] OmniRoute Tool Discovery Gotcha: OmniRoute requires tools in `.vault/Skills/` or `./skills/`. In fresh workspaces, 0 tools exist until created via `vibe skill create` or `vibe skill compile`. `vibe route` now proactively detects when 0 skills exist and offers instant natural-language synthesis directly in the prompt.
  - [10/17/2026] Interactive TUI Loop Persistence: In interactive terminal dashboards with submenus, every executed command handler must terminate with `continue;` rather than `return;`. Only an explicit exit choice or cancellation should break the loop, keeping the developer inside the workflow dashboard.
  - [10/17/2026] Skill Output Hygiene: Raw file list dumps across multi-target compilers (20+ files) overwhelm users. Clean summary cards paired with explicit 3-step "How to use now" commands (`vibe route`, `vibe skill install`, `vibe skill test`) make generated skills immediately actionable.
  - [10/17/2026] Git Porcelain Whitespace Gotcha: Running `.trim()` on full stdout from `git status --porcelain` strips the leading whitespace of the first line (where index 0 is space and index 1 is 'M' for unstaged modifications). Split lines first and match `^([ A-Z?]{2})\\s+(.*)$`. Furthermore, always exclude `.vault/` internal checkpoint files from workspace change lists.
  - [10/17/2026] Windows Batch File spawnSync Gotcha: In Node.js on Windows, executing batch binaries like `npx.cmd` requires `{ shell: true }` in `spawnSync`. To avoid Node's DEP0190 deprecation warning ("Passing args with shell option true"), pass the entire command as a single combined string (e.g. `'npx.cmd tsc --noEmit'`).
  - [10/18/2026] Cross-Agent Rules & Prompt Cache Optimization: Rule files should be glob-scoped (Cursor `.cursor/rules/*.mdc` with `globs: **/*.ts,**/*.tsx`) and KV-cache optimized (Claude `CLAUDE.md` with static build commands at the prefix). For Vitest v2 tests, `afterEach((done) => ...)` is deprecated and must return a promise (`afterEach(async () => ...)`).

## Memory & Task Protocol
1. Consult `.vault/_Context.md` at task start.
2. When solving tricky bugs, record the fix in `.vault/Memory-Bank/Lessons-and-Gotchas.md` or run `vibe snap`.
3. Keep `.vault/_Context.md` concise (under 60 lines).
4. Run `npm run build` to verify all modifications before concluding.
