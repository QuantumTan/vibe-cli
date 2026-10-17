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
* **Multi-Target Generation**: Emits **Google Antigravity** (`SKILL.md` + standalone runner), **Anthropic Claude / MCP Server** (zero-dependency stdio JSON-RPC 2.0 server), **Cursor & Windsurf** (`.cursorrules` & `.windsurfrules`), and **OpenAI & Anthropic** JSON tool schemas.
* **Deterministic Guardrails**: Auto-detects destructive verbs (`delete`, `drop`, `truncate`, `purge`, `format`, `kill`) and enforces explicit `confirm: true` or `dryRun: true` safety locks.
* **Zero-Dependency Runtime Shields**: Injects path traversal protection (blocks `..`, `System32`, `/etc`), SSRF metadata shields (`169.254.169.254`), and sensitive secret redaction.
* **Obsidian Vault Linkage**: Compiles skills directly into `.vault/Skills/<name>/` and automatically indexes them in `00-Symbol-Index.md` for live graph view visualization.

### 🧭 10. OmniRoute AI Tool Switchboard (`vibe route`)
Universal gateway and semantic intent dispatcher for all installed skills across your Obsidian vaults:
* **Natural Language Routing**: Type `vibe route "purge redis cache and drop stale keys"` to automatically discover, score, and execute matching tools across your skills with confidence ranking and parameter extraction.
* **MCP Server Multiplexer**: Run `vibe route --server` to expose all installed skills dynamically as a unified stdio MCP server for Antigravity, Cursor, and Claude Desktop.

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

## 🎮 Usage & Command Cheatsheet

### 1. Interactive Terminal UI (TUI)
Just type `vibe` with no arguments to launch the visual menu:

```powershell
vibe
```

Use `↑` / `↓` arrow keys to navigate and `Enter` to select:
```
┌  vibe  Multi-Vault Obsidian Orchestrator & Vibe Assistant
│
◇  What would you like to do?
│  ● 🔗 Link a Project to Obsidian
│  ○ 🔍 Bulk Scan Projects Directory
│  ○ 🚀 Launch Dev Server
│  ○ 🧠 Snap a Lesson / Gotcha to Obsidian
│  ○ ✅ Verify Codebase
│  ○ 📦 Wrap Up Session
│  ○ 🔄 Sync Junctions & Portfolio
│  ○ 📂 Manage Obsidian Vaults
│  ○ 🩺 Run Health Diagnostic
└
```

---

### 2. Command Reference

| Command | Description | Example |
| :--- | :--- | :--- |
| `vibe` | Opens the interactive main dashboard menu | `vibe` |
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
