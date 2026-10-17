import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface GuideTopic {
  id: string;
  title: string;
  description: string;
  content: string;
}

export const GUIDE_TOPICS: Record<string, GuideTopic> = {
  quickstart: {
    id: 'quickstart',
    title: 'First-Time Setup and Project Linking',
    description: 'Connect a codebase to an Obsidian vault with NTFS junctions',
    content: `
${pc.bold('First-Time Setup and Project Linking')}
-----------------------------------------
What it does:
Connects your project to an Obsidian vault via NTFS directory junctions.
AI coding agents (Antigravity, Cursor, Claude) use this live link to read
project context, memory bank notes, and architecture decisions in real time.

Prerequisites:
  • Node.js v20+ & npm
  • Git
  • Obsidian desktop app
  • Windows 10/11 (PowerShell) or macOS/Linux
  (Run 'vibe doctor' anytime to verify your environment)

Simple 3-Step Flow:
  1. Open your terminal in your project directory:
     cd C:\\Users\\ACER\\Documents\\Projects\\my-app

  2. Run the link command:
     vibe link
     This auto-detects your tech stack, links .vault/ to your Obsidian vault,
     and creates AGENTS.md with strict memory rules for AI coding assistants.

  3. Start using the interactive menu:
     vibe

Everyday Commands:
  vibe doctor                  Check environment health (Node, Git, Obsidian, SDKs)
  vibe link                    Link current project to default Obsidian vault
  vibe link --browse           Open native Windows folder picker to choose a vault
  vibe link --vault Work-Vault Link to a specific named vault
  vibe scan                    Auto-discover and batch-link all projects in a directory
  vibe init                    Create a brand-new Obsidian vault structure
`.trim(),
  },

  daily: {
    id: 'daily',
    title: 'Daily Development Workflow',
    description: 'The standard flow: dev, check, triage, snap, and wrapup',
    content: `
${pc.bold('Daily Development Workflow')}
---------------------------
What it does:
Your daily coding loop. Keeps your local environment verified, diagnoses build
failures instantly, and ensures hard-won lessons are remembered in your vault.

Simple 3-Step Flow:
  1. Start dev server and verify code:
     vibe dev                  Starts dev server (npm run dev, dotnet watch, artisan serve)
     vibe check                Runs builds, tests, and linter before making changes

  2. Diagnose failures fast:
     If a build or test fails, run:
     vibe triage
     Captures compiler error traces, isolates the broken lines with >>>,
     pulls past lessons from your vault, and copies a surgical fix prompt to clipboard.

  3. Save learnings and clean up:
     vibe snap "JWT refresh token race fixed by deduplicating requests"
     Saves the lesson directly to .vault/Memory-Bank/Lessons-and-Gotchas.md.
     vibe wrapup
     Archives completed tasks and trims _Context.md to under 60 lines for fast AI context.

Everyday Commands:
  vibe dev                     Start project dev server
  vibe check                   Verify project health (build, test, lint)
  vibe triage                  Analyze compiler failure and copy AI fix prompt
  vibe snap "lesson"           Record a gotcha or learning to Obsidian
  vibe wrapup                  Archive finished tasks and optimize context size
`.trim(),
  },

  architecture: {
    id: 'architecture',
    title: 'Feature Architecture and Specifications',
    description: 'Lock requirements, generate PRDs, compress context, and snapshot code',
    content: `
${pc.bold('Feature Architecture and Specifications')}
---------------------------------------
What it does:
Locks down feature requirements before writing code, compresses codebase context
so AI agents do not hallucinate, and protects working code with instant rollback snapshots.

Simple 3-Step Flow:
  1. Clarify feature requirements:
     vibe clarify "Subscription Billing"
     Runs a 5-pillar architectural interview (database, security, failure modes, UI, commercial)
     and saves a structured PRD spec in .vault/Specs/.

  2. Compress code context for AI prompts:
     vibe pack src/ -s
     Extracts TypeScript/Python AST signatures (types, exports, function headers)
     without bulky function bodies, saving 70% of tokens, and copies it to clipboard.

  3. Snapshot before major AI refactoring:
     vibe checkpoint "Before auth refactor"
     Saves an atomic backup of modified files. If the AI breaks your code:
     vibe rollback             Instantly reverts files to the checkpoint.

Everyday Commands:
  vibe clarify "Feature Name"  Interactive 5-pillar design interview and PRD generator
  vibe spec "Feature Name"     Scaffold a PRD template with schemas and test criteria
  vibe prompt "Task"           Generate high-precision prompt for AI coding agents
  vibe pack src/ -s            Extract compressed AST signatures to clipboard
  vibe canvas                  Generate interactive 2D architecture canvas in Obsidian
  vibe checkpoint "label"      Save atomic backup of working files
  vibe rollback                Revert modified files to last checkpoint
`.trim(),
  },

  topology: {
    id: 'topology',
    title: 'Codebase Topology and Database Schemas',
    description: 'Extract dependency maps, ER diagrams, and OpenAPI catalogs',
    content: `
${pc.bold('Codebase Topology and Database Schemas')}
---------------------------------------
What it does:
Scans your code, database schemas, and API endpoints, automatically generating
visual diagrams and specifications saved directly inside your Obsidian vault.

Simple 3-Step Flow:
  1. Visualize codebase dependencies:
     vibe map
     Scans imports across TypeScript, Python, Dart, C#, and PHP. Generates an
     interactive Mermaid dependency graph in .vault/Architecture/Codebase-Map.md.

  2. Map database entity relationships:
     vibe db
     Parses schema.prisma, schema.sql, or migration files. Emits an ER diagram
     and data dictionary in .vault/Architecture/Database-Schema.md.

  3. Document REST API endpoints:
     vibe api
     Discovers endpoints across Express, Next.js, FastAPI, and Laravel. Outputs
     a standards-compliant openapi.json and API reference with test curl commands.

Everyday Commands:
  vibe map                     Generate interactive Mermaid module dependency graph
  vibe db                      Generate database ER diagram and data dictionary
  vibe api                     Export OpenAPI 3.0 specification and curl test commands
`.trim(),
  },

  launch: {
    id: 'launch',
    title: 'Commercial Launch and Payments',
    description: 'Pre-flight checks, Stripe scaffolding, mock API, and environment audit',
    content: `
${pc.bold('Commercial Launch and Payments')}
-----------------------------
What it does:
Audits production readiness, scaffolds Stripe payments, tests frontend resilience
with local mock APIs, and safeguards sensitive credentials.

Simple 3-Step Flow:
  1. Run pre-flight release audit:
     vibe ship
     Audits placeholder keys, missing robots.txt, unhandled errors, and clean builds.
     Auto-scaffolds GDPR/CCPA Privacy Policy and Terms of Service templates.

  2. Scaffold commercial Stripe billing:
     vibe monetize
     Scaffolds Stripe Checkout endpoints, cryptographic webhook handlers, and
     a ready-to-use React pricing table component.

  3. Test frontend resilience before backend is ready:
     vibe mock --port 4000 --delay 150 --chaos 0.05
     Starts a local mock API with CORS, simulated network delay, and error chaos.

Everyday Commands:
  vibe ship                    Audit production readiness and scaffold legal policies
  vibe monetize                Scaffold Stripe billing, webhooks, and pricing table
  vibe mock                    Start local zero-dependency mock REST API
  vibe env --sync              Audit leaked live secrets and sync .env with .env.example
  vibe deps --fix              Scan dependencies for security vulnerabilities
  vibe commit                  Generate conventional commit messages from git diff
`.trim(),
  },

  skills: {
    id: 'skills',
    title: 'Custom Skills and MCP Tool Routing',
    description: 'Compile scripts into AI tools, run sandbox tests, and route natural intents',
    content: `
${pc.bold('Custom Skills and MCP Tool Routing')}
----------------------------------
What it does:
OmniRoute turns your scripts or natural language prompts into multi-target AI tools.
Tools can be installed into Antigravity, OpenCode, Nous Hermes, Claude Code, Cursor,
and Goose, or invoked directly using natural language.

Simple 3-Step Flow:
  1. Create or compile a skill:
     From natural language:
       vibe skill create "Flush Redis cache keys matching pattern"
     Or from an existing Python/TypeScript script:
       vibe skill compile ./scripts/backup.py -t all

  2. Install into your AI agent or editor:
     vibe skill install ./skills/flush-redis
     Automatically configures Antigravity, OpenCode (opencode.json),
     Nous Hermes (~/.hermes/skills/), Claude Code (.claude/mcp.json), and Cursor.

  3. Route natural language tasks directly to tools:
     vibe route "flush cache keys matching session_*"
     OmniRoute matches your intent, validates arguments, enforces safety guardrails,
     and executes the tool.

Everyday Commands:
  vibe skill create "intent"   Synthesize AI skill from natural language description
  vibe skill compile <file>    Compile Python/TS script into 7+ agent formats
  vibe skill list              List discovered skills and tools
  vibe skill test <dir>        Run security sandbox tests (path traversal, SSRF)
  vibe skill install <dir>     Install skill into Antigravity, OpenCode, Hermes, Claude, Cursor
  vibe route "task"            Dispatch natural language task across installed skills
  vibe route --server          Run persistent stdio MCP multiplexer for agent clients
`.trim(),
  },
};

export async function guideCommand(topicArg?: string): Promise<void> {
  const normalized = topicArg?.toLowerCase().trim();

  if (normalized && GUIDE_TOPICS[normalized]) {
    console.log('\n' + GUIDE_TOPICS[normalized].content + '\n');
    return;
  }

  if (normalized === 'all') {
    for (const key of Object.keys(GUIDE_TOPICS)) {
      console.log('\n' + GUIDE_TOPICS[key].content + '\n');
    }
    return;
  }

  p.intro(pc.bgCyan(pc.black(' vibe guide ')) + ' ' + pc.bold('Workflow Guides & Documentation'));

  while (true) {
    const selected = await p.select({
      message: 'Select a guide topic to read:',
      options: [
        { value: 'quickstart', label: '1. First-time setup & project linking', hint: 'vibe link, scan, init' },
        { value: 'daily', label: '2. Daily development loop', hint: 'dev, check, triage, snap, wrapup' },
        { value: 'architecture', label: '3. Feature architecture & specs', hint: 'clarify, spec, prompt, pack, canvas' },
        { value: 'topology', label: '4. Codebase topology & database', hint: 'map, db, api' },
        { value: 'launch', label: '5. Commercial launch & payments', hint: 'ship, monetize, mock, env, deps' },
        { value: 'skills', label: '6. Custom skills & tool routing', hint: 'skill, route' },
        { value: 'all', label: 'Print all guides', hint: 'Display complete manual' },
        { value: 'exit', label: 'Exit guide' },
      ],
    });

    if (p.isCancel(selected) || selected === 'exit') {
      p.outro('Done.');
      return;
    }

    if (selected === 'all') {
      for (const key of Object.keys(GUIDE_TOPICS)) {
        console.log('\n' + GUIDE_TOPICS[key].content + '\n');
      }
      p.outro('Done.');
      return;
    }

    const topic = GUIDE_TOPICS[selected as string];
    if (topic) {
      console.log('\n' + topic.content + '\n');
    }
  }
}
