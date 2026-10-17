# ⚡ vibe-cli

> **Automated Multi-Vault Obsidian Orchestrator, Auto-Discovery Engine & Vibe Coding Assistant**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Bundler](https://img.shields.io/badge/Bundled%20with-tsup-blueviolet)](https://tsup.egoist.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Cross--Platform-lightgrey)](https://github.com/)

---

## 🌟 Why `vibe-cli`?

**Vibe coding** is about staying in high-level flow state while AI agents (like **Antigravity**, **Cursor**, or **Claude**) write and verify the code. But daily development creates massive friction:

- You switch between projects and forget whether it was `npm run dev`, `dotnet watch run`, `php artisan serve`, or `flutter run`.
- Your AI agent forgets architectural decisions, repeats the same bugs, or suffers from context bloat.
- You have to manually organize notes, copy-paste snippets into Obsidian, and configure paths.

**`vibe-cli` completely eliminates this friction.** Point it at any folder (or your entire `Projects` directory): it auto-detects the tech stack, wires live two-way **NTFS Directory Junctions** into your **Obsidian Vaults**, generates strict AI memory bank rules (`AGENTS.md`), and gives you an interactive terminal UI for launching, verifying, and logging insights in real-time.

---

## 🏗️ Architecture: Live Two-Way Sync

Because `vibe` uses **Windows NTFS Directory Junctions** instead of file copies, your code editor and Obsidian are connected with **zero lag**:

```
                          ┌───────────────────────────┐
                          │   Terminal / vibe CLI     │
                          │   (vibe link, dev, snap)  │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┴───────────────────────────┐
           ▼                                                        ▼
┌─────────────────────────────────┐                      ┌─────────────────────────────────┐
│     Project Codebase Repo       │                      │      Central Obsidian Vault     │
│   (e.g., Projects/MyCoolApp)    │                      │   (e.g., Obsidian/Dev-Vault)    │
│                                 │                      │                                 │
│  ├── src/                       │                      │  ├── 00-Dashboard.md            │
│  ├── AGENTS.md (AI directives)  │                      │  ├── 00-Global-Rules/           │
│  │                              │                      │  │   └── AGENTS.md              │
│  ├── .vault-global/ ────────────┼──[NTFS Junction]────►│  │                              │
│  │                              │                      │  └── 02-Projects/               │
│  └── .vault/ ───────────────────┼──[NTFS Junction]────►│      └── MyCoolApp/             │
│       ├── _Context.md           │                      │           ├── _Context.md       │
│       ├── Memory-Bank/          │                      │           ├── Memory-Bank/      │
│       │   ├── Lessons.md        │                      │           │   ├── Lessons.md    │
│       │   └── Archive.md        │                      │           │   └── Archive.md    │
│       └── Architecture/         │                      │           └── Architecture/     │
└─────────────────────────────────┘                      └─────────────────────────────────┘
           ▲                                                        ▲
           │                                                        │
           └────────────── Antigravity / AI Agent Prompt ───────────┘
               (Writes to .vault/ ──► Instantly updates Obsidian!)
```

---

## ✨ Key Features

### 🔍 1. Zero-Prompt Auto-Detection
Inspects codebases without asking manual questions:
* **Web & Fullstack**: React, Next.js, Vue, Svelte, Astro, Vite, Tailwind CSS, TypeScript, Express, NestJS (`npm run build` / `npm run dev`).
* **PHP / Fullstack**: Laravel, Artisan, Composer (`php artisan test` / `php artisan serve`).
* **Desktop (.NET)**: C#, .NET 10, WPF, WinForms (`dotnet build` / `dotnet watch run`).
* **Mobile**: Flutter, Dart, Android/iOS package detection (`flutter analyze` / `flutter run`).
* **Systems & Scripting**: Rust (Cargo), Python, Go.
* **Git Remote**: Normalizes SSH/HTTPS GitHub URLs directly from `.git/config`.
* **README Summary**: Extracts clean non-heading descriptions truncated to 140 characters.

### ⚡ 2. Bulk Directory Scanning (`vibe scan`)
Scan your entire `Projects` directory in one command. `vibe` discovers all unlinked codebases, displays their auto-detected tech stacks, and lets you batch-wire them with an interactive spacebar checklist (or `--all`).

### 📂 3. Native Windows GUI Folder Picker
Zero bulky C++ npm dependencies. Spawns a native Windows `FolderBrowserDialog` in the foreground (`powershell.exe -Sta`) whenever you pass `--browse` or choose visual browsing from the terminal menu.

### 💎 4. Multi-Vault Management
Switch between client vaults, personal vaults, and side-project vaults on the fly. Create new vaults, switch default vaults, or browse for an existing Obsidian vault anywhere on your drive.

### 🧠 5. AI Flow-State Memory Bank
* **`vibe snap "<message>"`**: Log a tricky bug fix or architectural decision straight to Obsidian's `Memory-Bank/Lessons-and-Gotchas.md` without switching windows.
* **`vibe wrapup`**: Moves completed tasks (`- [x]`) into `Archive.md` and keeps `_Context.md` under 60 lines so your AI context window stays fast and razor-sharp.
* **`AGENTS.md`**: Injects strict platform-tailored directives for Antigravity, Cursor, and Claude.

### 🚀 6. Universal Dev & Test Runner
* **`vibe dev`**: One unified launcher that triggers the right dev server for whatever project you are in.
* **`vibe check`**: Runs the auto-detected verification suite before you commit.

### 🎨 7. Portfolio Showcase Sync (`vibe sync` & `vibe showcase`)
Toggle `showcase: true` on any project note. `vibe sync` extracts all showcase projects across all vaults and generates clean JSON and Markdown collections for your portfolio website (e.g. `BentoPortfolio`).

### 🩺 8. Rig Health Diagnostic (`vibe doctor`)
One command to verify the status of Node.js, NPM, Git, .NET SDK, Flutter SDK, PHP/Composer, Python, and Obsidian Vault health.

### ⚡ 9. Multi-Target AI Skill & MCP Engine (`vibe skill`)
Natively compile any Python, TypeScript, Bash script, or natural language intent into production AI agent skills with deterministic runtime safety shields:
* **Multi-Target Generation**: Emits **Google Antigravity** (`SKILL.md` + standalone runner), **Anthropic Claude / MCP Server** (zero-dependency stdio JSON-RPC 2.0 server), **Cursor & Windsurf** (`.cursorrules` & `.windsurfrules`), **OpenAI & Anthropic** JSON tool schemas, **OpenCode Harness** (`opencode.json` with permission policies), **Nous Hermes Agent** (`hermes-tools.json`, `skill.yaml`, and `<tools>` function prompt templates), **Goose (Block)** (`goose-extension.yaml` & `.goosehints`), **Claude Code** (`.claude/mcp.json` & `CLAUDE.md`), **OpenHands** (`.openhands/microagents/`), **Aider** (`.aider.conf.yml`), and **Continue.dev** (`continue-config.json`).
* **Deterministic Guardrails**: Auto-detects destructive verbs (`delete`, `drop`, `truncate`, `purge`, `format`, `kill`) and enforces explicit `confirm: true` or `dryRun: true` safety locks.
* **Zero-Dependency Runtime Shields**: Injects path traversal protection (blocks `..`, `System32`, `/etc`), SSRF metadata shields (`169.254.169.254`), and sensitive secret redaction.
* **Obsidian Vault Linkage**: Compiles skills directly into `.vault/Skills/<name>/` and automatically indexes them in `00-Symbol-Index.md` for live graph view visualization.

### 🧭 10. OmniRoute AI Tool Switchboard (`vibe route`)
Universal gateway and semantic intent dispatcher for all installed skills across your Obsidian vaults:
* **Natural Language Routing**: Type `vibe route "purge redis cache and drop stale keys"` to automatically discover, score, and execute matching tools across your skills with confidence ranking and parameter extraction.
* **MCP Server Multiplexer**: Run `vibe route --server` to expose all installed skills dynamically as a unified stdio MCP server for Antigravity, Cursor, and Claude Desktop.
* **Workspace Skill Registry**: OmniRoute discovers tools in `.vault/Skills/` and `./skills/`. In a fresh project, no tools exist initially. Create your first skill with `vibe skill create` or `vibe skill compile` before routing. If no skills exist when you run `vibe route`, OmniRoute offers to synthesize your intent into a new skill immediately.

### 🧠 11. Principal Architect Feature Interview (`vibe clarify`)
Eliminates vague prompts and costly mid-sprint architectural refactors:
* **Architectural Questionnaire**: Grills the developer across 5 foundational pillars: Data & Persistence, Auth & Security Boundary, Failure & Resilience Strategy, Latency & Optimistic UI Profile, and Commercial Controls.
* **Locked Production PRD**: Synthesizes a structured PRD into `.vault/Specs/<feature>-PRD.md` with complete TypeScript schemas, typed error boundaries, and copies strict anti-slop prompt directives to the clipboard.

### 🚢 12. Commercial Launch Gate & Launchpad (`vibe ship`)
The ultimate pre-flight checklist for deploying profitable, production-grade applications:
* **Secrets & Env Sanitization**: Blocks placeholder and staging keys (`sk_test_`, `localhost:8080`, `CHANGEME`).
* **SEO & Web Asset Scaffolding**: Ensures `public/robots.txt` is present and properly configured.
* **Legal Compliance Suite**: Auto-scaffolds GDPR/CCPA-compliant `Privacy-Policy.md` and `Terms-of-Service.md` into `.vault/Legal/`.
* **Zero-Error Verification Gate**: Runs the project's native build and test suite (`npm run build`, `dotnet build`, etc.).
* **Deployment Automation**: Scaffolds production multi-stage `Dockerfile` and GitHub Actions CI/CD workflows if missing.

### 💾 13. Instant Time-Machine & Rollback Engine (`vibe checkpoint` & `vibe rollback`)
Zero-risk AI coding. Snapshot working code before letting agents make complex changes:
* **`vibe checkpoint [label]`**: Creates an atomic snapshot of modified and critical workspace files with git commit hashing in `.vault/Checkpoints/`.
* **`vibe rollback [id]`**: 1-click restoration to any previous snapshot, instantly rescuing code from AI hallucinations or broken refactors.

### 🗺️ 14. Codebase Topology & AST Grapher (`vibe map`)
Gives AI agents deep architectural awareness of module relationships:
* **Symbol & Route Extraction**: Scans TypeScript, Python, Dart, C#, and PHP for exported functions, classes, interfaces, relative dependencies, and REST API endpoints.
* **Interactive Mermaid Diagrams**: Auto-generates living architectural dependency graphs in `.vault/Architecture/Codebase-Map.md` linked to Obsidian's Symbol Index.

### 💳 15. Commercial Monetization Suite (`vibe monetize`)
Scaffold revenue-generating billing infrastructure in 1 step:
* **Stripe Checkout & Webhooks**: Scaffolds Next.js/Express API routes with cryptographic webhook signature verification (`stripe.webhooks.constructEvent`) and subscription lifecycle handlers.
* **Pricing Table Component**: Generates a modern React `<PricingTable />` with monthly/yearly toggles, feature checklists, and checkout redirect handlers.
* **Architecture Spec**: Generates `.vault/Specs/Monetization-Architecture.md` with Stripe CLI testing workflows.

### 🧪 16. Instant Zero-Dependency Mock REST API Server (`vibe mock`)
Develop frontends in React, Flutter, or Vue before the backend is built:
* **Built-in Node.js HTTP Server**: Runs on port 4000 with zero external dependencies, full CORS support, and automatic in-memory CRUD operations (`GET`, `POST`, `PUT`, `DELETE`).
* **Chaos & Network Simulation**: Simulate network latency (`--delay 200`) and chaos error rates (`--chaos 0.1` for 10% 500 responses) to stress-test UI resilience.

### 🗄️ 17. Database & Schema Visualizer (`vibe db`)
Keep AI agents grounded with zero database schema hallucination:
* **Prisma & SQL Parser**: Automatically parses `schema.prisma`, `schema.sql`, or migration files into tables, fields, types, and primary/foreign key relationships.
* **Living ER Diagrams**: Auto-generates interactive Mermaid `erDiagram` visual models and typed data dictionaries directly into `.vault/Architecture/Database-Schema.md`.

### 🪶 18. Token-Optimized AI Context Packer (`vibe pack`)
Feed dense codebase context to AI models without blowing token limits:
* **AST Tree-Shaking**: Pass `--signatures-only` to strip function bodies and retain strictly types, interfaces, and function headers (saving 70-80% of tokens).
* **Token Estimator & Auto-Copy**: Estimates token counts (~4 chars/token) and copies compressed context directly to the Windows Clipboard for 1-click paste into Antigravity or Cursor.

### 📝 19. Semantic Conventional Commit & Changelog Engine (`vibe commit`)
Never write lazy `"wip"` or `"fix"` commit messages again:
* **Smart Diff Analyzer**: Analyzes staged/unstaged changes, detected file scopes, additions, and deletions.
* **Conventional Commit Synthesis**: Generates crisp `feat(scope): ...`, `fix(scope): ...`, `test(scope): ...` proposals.
* **Living Changelog**: Automatically updates `.vault/Changelog.md` and root `CHANGELOG.md` upon confirmation.

### 🔒 20. Environment & Secret Sentinel (`vibe env`)
Shield production secrets from accidental GitHub leaks and prevent CI deploy failures:
* **Diff Audit & Auto-Sync**: Compares `.env` vs `.env.example`. Pass `--sync` to automatically append missing keys with sanitized dummy placeholders.
* **Live Secret Detector**: Detects high-risk leaked keys (`sk_live_`, `ghp_`, `AKIA`) and verifies `.env` is protected by `.gitignore`.

### 🎨 21. Native Obsidian Visual Canvas Generator (`vibe canvas`)
Transform your startup codebase into an interactive 2D whiteboard:
* **Native Obsidian .canvas Generator**: Generates `<Vault>/02-Projects/<name>/Project-Canvas.canvas` with structured visual cards (Project Hub, Active Sprint Tasks, Architecture Map, Database ER Diagram, Memory Bank Lessons).
* **Connected Directional Edges**: Connects components with colored relational edges for birds-eye architectural clarity.

### 🩺 22. Autonomous AI Failure Triage & Self-Healing (`vibe triage`)
Eliminate the frustration of deciphering cryptic compile or test stack traces:
* **Deterministic Trace Extractor**: Executes test or build commands (`npm test`, `dotnet build`, `pytest`, etc.), captures error traces, and pinpoints offending source files, lines, and columns.
* **Contextual Code Extraction**: Slices lines of source surrounding the crash and correlates known issues from Obsidian's `Lessons-and-Gotchas.md`.
* **Surgical Fix Synthesis**: Generates an authoritative, anti-hallucination fix prompt and copies it straight to the Windows clipboard for 1-click paste into your AI agent.

### 🌐 23. OpenAPI 3.0 Exporter & cURL Reference (`vibe api`)
Bridge your codebase topology directly to industry-standard API tooling:
* **Standards-Compliant OpenAPI 3.0**: Auto-discovers REST endpoints from Express, Next.js, FastAPI, Laravel, and ASP.NET Core, exporting them to `openapi.json`.
* **Living Markdown API Reference**: Auto-generates `.vault/Architecture/API-Reference.md` inside Obsidian with pre-computed `curl` examples and schema documentation.

### 📦 24. Cross-Platform Supply-Chain & Dependency Auditor (`vibe deps`)
Keep dependencies clean, secure, and up-to-date across Node, Python, .NET, and PHP:
* **Automated Audit**: Audits lockfiles and package manifests against known CVE security advisories and outdated package registries.
* **Automated Remediation**: Pass `--fix` to safely upgrade or remediate vulnerable dependencies automatically.

### 🎛️ 25. 2-Tier Categorized Workspace TUI (`vibe`)
A beautiful, clutter-free interactive dashboard organizing all 32 commands into 5 focused workspaces:
* **⚡ Daily Vibe Flow**: Launch dev server, run checks, snap lessons, wrap up sessions, and trigger failure triage.
* **🧠 AI Architecture & Specs**: Master prompts, Principal Architect interviews, PRDs, context packing, and time-machine checkpoints.
* **🗺️ Codebase & Data Topology**: Architectural dependency maps, database ER diagrams, and OpenAPI route references.
* **💳 Commercial Launch & Revenue**: Stripe monetization scaffolding, launchpad gate, audits, and mock REST servers.
* **⚡ AI Agent Skills & Obsidian Hub**: Multi-target compiler, OmniRoute switchboard, vault manager, and auto-discovery scanner.

---

## 📦 Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- Windows 10/11 (PowerShell available)
- [Obsidian](https://obsidian.md/) (installed)

### Local Global Install
Clone this repository and link it globally on your machine:

```powershell
git clone https://github.com/your-username/vibe-cli.git
cd vibe-cli
npm install
npm run build
npm link
```

Now `vibe` is globally accessible anywhere in your terminal!

---

---

## 📖 How to Use `vibe-cli`

### 1. In-Terminal Interactive UI & Built-In Guides

Run `vibe` with no arguments from any terminal to open the clean navigation menu:

```powershell
vibe
```

```text
  vibe v1.1.0 · workspace & vault manager
  dir: my-app | vault: Dev-Vault | projects: 1 linked

◆  Action or workspace:
│  ● Dev server                   vibe dev
│  ○ Verify build & tests         vibe check
│  ○ Triage failure               vibe triage
│  ○ Log lesson note              vibe snap
│  ○ Wrap up session              vibe wrapup
│  ○ Link project to vault        vibe link
│  ○ Architecture & specs...      clarify, spec, prompt, pack, canvas
│  ○ Topology & schemas...        map, db, api
│  ○ Launch & payments...         ship, monetize, mock, env, deps
│  ○ Skills & ecosystem...        route, skill, scan, doctor
│  ○ Usage guides & workflows...  vibe guide
│  ○ Exit
```

You can also read interactive step-by-step guides directly inside your terminal anytime:

```powershell
# Open interactive guide picker
vibe guide

# Or jump directly to a specific workflow guide
vibe guide quickstart
vibe guide daily
vibe guide architecture
vibe guide topology
vibe guide launch
vibe guide skills
```

---

### 2. Practical Developer Workflows

#### Workflow 1: Quickstart & Project Setup
Connect any repository to your central Obsidian vault in seconds:
```powershell
cd C:\Users\ACER\Documents\Projects\my-app
vibe link
```
- Auto-detects tech stack (Next.js, React, Vite, .NET, Laravel, Flutter, Python, Go).
- Creates a two-way NTFS directory junction (`.vault/`) pointing into your Obsidian vault.
- Generates `AGENTS.md` and `.vault/_Context.md` so AI coding agents never lose project context.

#### Workflow 2: Daily Development Loop
Stay in flow state without context-switching between notes and code:
1. **Launch dev environment**: `vibe dev` (runs the detected server: `npm run dev`, `dotnet watch run`, etc.).
2. **Verify changes**: `vibe check` (runs detected tests and builds before you commit).
3. **Triage errors**: If a test or build fails, run `vibe triage`. It parses stack traces across Node, TypeScript, Python, or .NET, isolates the 10-line source snippet with pointer `>>>`, checks your vault for known gotchas, and copies a surgical fix prompt to your clipboard.
4. **Log learnings**: `vibe snap "Fixed token refresh race condition"` saves the insight directly into Obsidian's `Lessons-and-Gotchas.md`.
5. **Wrap up session**: `vibe wrapup` archives completed tasks (`- [x]`) and prunes `_Context.md` under 60 lines so future AI prompts stay fast.

#### Workflow 3: Feature Architecture & PRD Specifications
Eliminate prompt drift and mid-sprint rewrites before writing code:
1. **Principal Architect Interview**: `vibe clarify "Stripe Subscriptions"` grills you across 5 architectural pillars (persistence, security, failure modes, UI latency, commercial limits) and locks down a complete PRD.
2. **Scaffold PRD**: `vibe spec "Team Workspaces"` generates feature blueprints in Obsidian.
3. **Token-dense context**: `vibe pack src/api -s` extracts AST exports, types, and function signatures without bodies, saving 70-80% of tokens and copying the compressed context to your clipboard.
4. **Interactive Whiteboard**: `vibe canvas` generates a 2D native Obsidian `.canvas` connecting project tasks, architecture diagrams, and database schemas.
5. **Time-Machine Snapshots**: `vibe checkpoint "Before auth refactor"` creates an atomic file snapshot. If an AI agent hallucination breaks working code, restore immediately with `vibe rollback`.

#### Workflow 4: Codebase Intelligence & Schemas
Give AI agents deep architectural awareness of your codebase:
1. **Module Dependency Map**: `vibe map` extracts exported symbols, imports, and endpoints, emitting an interactive Mermaid graph into `.vault/Architecture/Codebase-Map.md`.
2. **Database ER Diagrams**: `vibe db` parses Prisma or SQL schema files into visual Mermaid entity-relationship diagrams and typed data dictionaries in `.vault/Architecture/Database-Schema.md`.
3. **OpenAPI 3.0 Documentation**: `vibe api` discovers API routes across Express, Next.js, FastAPI, Laravel, and ASP.NET Core, exporting standard `openapi.json` and `.vault/Architecture/API-Reference.md` with ready-to-run `curl` commands.

#### Workflow 5: Pre-Flight Launch & Commercial Readiness
Prepare applications for production and monetization:
1. **Launch Gate**: `vibe ship` audits against leaked staging keys, verifies `robots.txt`, scaffolds GDPR/CCPA Privacy Policy and Terms of Service, and runs build verification.
2. **Stripe Billing**: `vibe monetize` scaffolds Stripe Checkout routes, cryptographic webhook handlers, and a modern React pricing table component.
3. **Mock REST API**: `vibe mock --port 4000 --delay 150 --chaos 0.05` launches a zero-dependency local HTTP API server with in-memory CRUD, CORS, and latency simulation.
4. **Environment Audit**: `vibe env --sync` compares `.env` vs `.env.example`, alerts on leaked production credentials, and appends missing keys with safe placeholders.
5. **Dependency Audit**: `vibe deps --fix` audits package manifests against CVE advisories and outdated packages with optional automated remediation.
6. **Conventional Commit**: `vibe commit` analyzes git diffs, drafts conventional commit messages (`feat`, `fix`, `refactor`), and updates `CHANGELOG.md`.

#### Workflow 6: Custom AI Skills & Tool Routing
Build and deploy deterministic AI tools:
1. **Understand the Registry**: OmniRoute discovers tools located in `.vault/Skills/` and `./skills/`. In a fresh project, no tools exist until you create or compile one.
2. **Synthesize tool from intent**: `vibe skill create "Flush Redis cache keys matching pattern"` creates a guarded skill with parameter schemas, safety locks, and an executable runner from natural language.
3. **Compile existing scripts**: `vibe skill compile ./scripts/backup.py -t all` generates tools for Google Antigravity, MCP stdio server, Cursor, OpenAI/Anthropic schemas, OpenCode, Nous Hermes Agent, Goose, Claude Code, OpenHands, Aider, and Continue.dev with path traversal and SSRF shields.
4. **Ingest API**: `vibe skill from-api ./swagger.json` converts OpenAPI specifications into guarded AI agent tools.
5. **List installed skills**: `vibe skill list` shows all active skills and their target platforms.
6. **Safety sandbox**: `vibe skill test ./skills/db-cleaner` tests tools against security attack payloads.
7. **Install to agents**: `vibe skill install ./skills/db-cleaner` wires tools into Claude Desktop, Antigravity, Cursor, OpenCode, Nous Hermes Agent, Goose, Claude Code, and OpenHands.
8. **Tool Switchboard**: `vibe route "purge expired sessions"` routes natural language intents directly to matching tools, or `vibe route --server` runs as a unified stdio MCP server.

---

### 3. Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `vibe` | Opens the interactive main dashboard menu | `vibe` |
| `vibe guide [topic]` | In-terminal workflow guides: quickstart, daily, architecture, topology, launch, skills | `vibe guide` or `vibe guide daily` |
| `vibe link [path]` | Auto-detects and wires a project codebase to an Obsidian vault | `vibe link` or `vibe link "D:\Code\App" --browse` |
| `vibe scan [rootDir]` | Bulk scans folder for unlinked projects and batch-wires them | `vibe scan` or `vibe scan --all` |
| `vibe init [name]` | Scaffolds a new project folder and wires it to Obsidian | `vibe init my-new-app` |
| `vibe new-vault [name]` | Shortcut: Scaffolds and registers a new Obsidian vault | `vibe new-vault Client-Vault` |
| `vibe audit [path]` | Runs commercial readiness & quality audit (security, payments, UX) | `vibe audit` |
| `vibe prompt [task]` | Synthesizes codebase context and copies anti-slop master prompt to clipboard | `vibe prompt "Add Stripe billing"` |
| `vibe clarify [feature]` | Principal Architect interview: eliminates prompt drift & locks down architectural PRD | `vibe clarify "Stripe Checkout"` |
| `vibe spec [feature]` | Generates a complete PRD & feature specification in Obsidian | `vibe spec "Subscription Billing"` |
| `vibe ship [path]` | Commercial launch gate & launchpad (secrets, GDPR legal suite, SEO, CI/CD) | `vibe ship` |
| `vibe route [intent]` | OmniRoute AI Tool Gateway: semantic dispatcher & MCP server multiplexer | `vibe route "purge redis cache"` |
| `vibe checkpoint [label]` | Creates an instant time-machine snapshot before AI agent edits | `vibe checkpoint "Before auth refactor"` |
| `vibe rollback [id]` | Restores workspace files to a previous stable checkpoint | `vibe rollback` |
| `vibe map [path]` | Extracts codebase topology, module dependencies, and API routes | `vibe map` |
| `vibe monetize [path]` | Scaffolds complete commercial Stripe subscriptions & billing | `vibe monetize` |
| `vibe mock [dataFile]` | Launches zero-dependency local REST mock API server with CORS | `vibe mock` |
| `vibe db [path]` | Parses database schema (Prisma/SQL), generates ER diagram & data dictionary | `vibe db` |
| `vibe pack [pattern]` | Compresses source code into token-dense AST signatures & copies to clipboard | `vibe pack src/api -s` |
| `vibe commit [msg]` | Analyzes git diff, generates conventional commit, and updates CHANGELOG | `vibe commit` |
| `vibe env [--sync]` | Audits .env vs .env.example, detects secret leaks, and auto-syncs placeholders | `vibe env --sync` |
| `vibe canvas [path]` | Generates native Obsidian 2D interactive visual canvas whiteboard | `vibe canvas` |
| `vibe triage [cmd]` | Autonomous AI failure triage: captures errors, extracts code snippet & copies surgical fix prompt | `vibe triage` or `vibe triage "npm test"` |
| `vibe api [path]` | Exports standards-compliant OpenAPI 3.0 specification & cURL API Reference to Obsidian | `vibe api` |
| `vibe deps [--fix]` | Cross-platform dependency security auditor & outdated package scanner | `vibe deps --fix` |
| `vibe dev` | Launches the auto-detected development server | `vibe dev` |
| `vibe check` | Runs the auto-detected build/test verification suite | `vibe check` |
| `vibe snap "<note>"` | Logs a lesson, gotcha, or decision into Obsidian Memory Bank | `vibe snap "Fixed JWT refresh race condition"` |
| `vibe wrapup` | Archives `- [x]` completed tasks and prunes `_Context.md` <= 60 lines | `vibe wrapup` |
| `vibe showcase [on/off]` | Toggles portfolio showcase visibility for the current project | `vibe showcase on` |
| `vibe sync` | Heals broken NTFS junctions and publishes showcase projects | `vibe sync` |
| `vibe watch [--auto-link]` | Live daemon watching for vault changes and auto-wiring new projects | `vibe watch --auto-link` |
| `vibe vault list` | Lists all registered Obsidian vaults and linked project counts | `vibe vault list` |
| `vibe vault create [name]` | Scaffolds a new Obsidian vault (`--browse` supported) | `vibe vault create Client-Vault` |
| `vibe vault switch [name]` | Changes the active default vault | `vibe vault switch Dev-Vault` |
| `vibe skill compile [file]` | Compiles scripts into Antigravity, MCP, Cursor, & OpenAI targets | `vibe skill compile ./scripts/db.py -t all` |
| `vibe skill create [intent]` | Synthesizes a multi-target AI skill from natural language | `vibe skill create "Purge cache keys"` |
| `vibe skill from-api [spec]` | Ingests OpenAPI/Swagger JSON or URL and compiles guarded tools | `vibe skill from-api ./swagger.json` |
| `vibe skill test [skill]` | Runs safety attack sandbox (path traversal, SSRF, destructive lock) | `vibe skill test ./skills/db-cleaner` |
| `vibe skill install [skill]` | 1-click install into Claude Desktop, Antigravity, and Cursor | `vibe skill install ./skills/db-cleaner` |
| `vibe skill audit [skill]` | Static security, parameter schema, and guardrail audit | `vibe skill audit ./skills/db-cleaner` |
| `vibe skill list` | Lists installed AI agent skills and their active targets | `vibe skill list` |
| `vibe doctor` | Multi-platform environment and toolchain health check | `vibe doctor` |

---

## ⚙️ Configuration Schema (`~/.vibeconfig.json`)

On first run, `vibe` initializes a global configuration file in your home directory:

```json
{
  "defaultVault": "Dev-Vault",
  "vaultsRoot": "C:\\Users\\ACER\\Documents\\Obsidian Vaults",
  "projectsRoot": "C:\\Users\\ACER\\Documents\\Projects",
  "portfolioRepoPath": "C:\\Users\\ACER\\Documents\\Projects\\BentoPortfolio",
  "vaults": {
    "Dev-Vault": "C:\\Users\\ACER\\Documents\\Obsidian Vaults\\Dev-Vault"
  },
  "registeredProjects": [
    {
      "name": "BentoPortfolio",
      "path": "C:\\Users\\ACER\\Documents\\Projects\\BentoPortfolio",
      "vault": "Dev-Vault",
      "stack": ["React", "TypeScript", "Vite", "Tailwind CSS"],
      "category": "Web App",
      "verifyCmd": "npm run build",
      "devCmd": "npm run dev",
      "showcase": true,
      "linkedAt": "2026-10-17T14:55:00.000Z"
    }
  ]
}
```

---

## 🧪 Testing & Development

Run unit tests and build using Vitest and tsup:

```powershell
# Run unit tests
npm test

# Build production bundle
npm run build

# Run in watch mode during development
npm run dev
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
