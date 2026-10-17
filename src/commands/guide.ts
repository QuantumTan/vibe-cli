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

1. Open your terminal in any project directory:
   cd C:\\Users\\ACER\\Documents\\Projects\\my-app

2. Run the link command:
   vibe link

   vibe will auto-detect your stack (React, Next.js, .NET, Laravel, Flutter, etc.),
   create an NTFS directory junction (.vault/) pointing to your Obsidian vault,
   and generate AGENTS.md with strict instructions for AI coding assistants.

3. Optional flags:
   vibe link --browse           Open a native Windows folder picker
   vibe link --vault Work-Vault Target a specific registered vault
   vibe scan                    Scan a parent folder to batch-link multiple projects
`.trim(),
  },

  daily: {
    id: 'daily',
    title: 'Daily Development Workflow',
    description: 'The standard flow: dev, check, triage, snap, and wrapup',
    content: `
${pc.bold('Daily Development Workflow')}
---------------------------

Step 1: Start your development environment
  vibe dev
  Automatically runs the correct dev server (npm run dev, dotnet watch, artisan serve).

Step 2: Verify your changes
  vibe check
  Runs your project's verification suite (build, test, lint) before making commits.

Step 3: Triage failures if tests or builds break
  vibe triage
  Captures compiler and test error traces, extracts a 10-line source snippet with
  pointer >>>, references past lessons, and copies a surgical fix prompt to your clipboard.

Step 4: Record learnings and gotchas
  vibe snap "JWT refresh token race condition resolved by deduplicating refresh calls"
  Appends the insight directly to Obsidian at Memory-Bank/Lessons-and-Gotchas.md.

Step 5: End your session cleanly
  vibe wrapup
  Archives completed tasks from _Context.md into Memory-Bank/Archive.md and trims
  _Context.md to under 60 lines so AI context windows stay fast and accurate.
`.trim(),
  },

  architecture: {
    id: 'architecture',
    title: 'Feature Architecture and Specifications',
    description: 'Lock requirements, generate PRDs, compress context, and snapshot code',
    content: `
${pc.bold('Feature Architecture and Specifications')}
---------------------------------------

1. Clarify requirements before coding:
   vibe clarify "Subscription Billing"
   Runs an architectural interview across 5 pillars (persistence, security, failure,
   UI profile, commercial controls) and saves a structured PRD to .vault/Specs/.

2. Scaffold a feature specification:
   vibe spec "Team Workspaces"
   Generates a structured PRD template with schemas, edge cases, and test criteria.

3. Feed dense codebase context to AI agents:
   vibe pack src/api -s
   Extracts AST signatures (exports, interfaces, function headers) without function
   bodies, saving 70-80% of tokens, and copies the compressed context to your clipboard.

4. Generate visual architecture canvas:
   vibe canvas
   Generates a 2D interactive .canvas whiteboard file inside Obsidian connecting
   the project hub, tasks, database models, and memory bank notes.

5. Save safety snapshots before AI refactors:
   vibe checkpoint "Before auth rewrite"
   Saves an atomic snapshot of modified files. If anything breaks:
   vibe rollback
`.trim(),
  },

  topology: {
    id: 'topology',
    title: 'Codebase Topology and Database Schemas',
    description: 'Extract dependency maps, ER diagrams, and OpenAPI catalogs',
    content: `
${pc.bold('Codebase Topology and Database Schemas')}
---------------------------------------

1. Extract codebase module topology:
   vibe map
   Scans TypeScript, Python, Dart, C#, and PHP for exported classes, functions,
   and relative imports. Generates an interactive Mermaid dependency graph in
   .vault/Architecture/Codebase-Map.md.

2. Parse database schema:
   vibe db
   Parses schema.prisma, schema.sql, or migration files. Emits an entity-relationship
   Mermaid diagram and a data dictionary in .vault/Architecture/Database-Schema.md.

3. Export REST API documentation:
   vibe api
   Discovers endpoints across Express, Next.js, FastAPI, Laravel, and ASP.NET Core.
   Outputs a standards-compliant openapi.json and .vault/Architecture/API-Reference.md
   complete with pre-computed curl test commands.
`.trim(),
  },

  launch: {
    id: 'launch',
    title: 'Commercial Launch and Payments',
    description: 'Pre-flight checks, Stripe scaffolding, mock API, and environment audit',
    content: `
${pc.bold('Commercial Launch and Payments')}
-----------------------------

1. Run pre-flight release checks:
   vibe ship
   Audits against placeholder keys, missing robots.txt, unhandled errors, and builds.
   Auto-scaffolds GDPR/CCPA Privacy Policy and Terms of Service documents.

2. Scaffold Stripe payments:
   vibe monetize
   Scaffolds Stripe Checkout endpoints, cryptographic webhook signature handlers,
   and a React pricing table component.

3. Run zero-dependency local mock API:
   vibe mock --port 4000 --delay 150 --chaos 0.05
   Starts an in-memory REST API server with full CORS, latency simulation, and
   configurable error chaos to test frontend resilience before backends are built.

4. Audit environment secrets:
   vibe env --sync
   Compares .env with .env.example, flags leaked live secrets (sk_live_, ghp_),
   and automatically appends missing keys with safe placeholder values.

5. Audit supply-chain dependencies:
   vibe deps --fix
   Scans package manifests against CVE vulnerability advisories and outdated packages.

6. Commit with conventional format:
   vibe commit
   Analyzes git diff and drafts conventional feat(scope), fix(scope) commit messages.
`.trim(),
  },

  skills: {
    id: 'skills',
    title: 'Custom Skills and MCP Tool Routing',
    description: 'Compile scripts into AI tools, run sandbox tests, and route natural intents',
    content: `
${pc.bold('Custom Skills and MCP Tool Routing')}
----------------------------------

OmniRoute is an AI tool gateway and dispatcher. It matches your prompts to
custom skills compiled in your Obsidian vault (.vault/Skills/) or ./skills/.

Prerequisite: In a fresh project, no tools exist initially. You must compile
or create at least one skill before routing intents.

1. Create a skill from natural language:
   vibe skill create "Flush Redis cache keys matching pattern"
   Generates tool schemas, safety guardrails, MCP server, and runner.

2. Compile an existing Python or TypeScript script:
   vibe skill compile ./scripts/backup.py -t all
   Extracts functions, types, and docstrings into multi-target skill definitions:
   Antigravity, MCP Server, Cursor, OpenAI, OpenCode, Nous Hermes, Goose,
   Claude Code, OpenHands, Aider, and Continue.dev.

3. Ingest OpenAPI into guarded tools:
   vibe skill from-api ./swagger.json

4. List installed skills:
   vibe skill list
   Shows active skills and their compilation targets.

5. Test skill security sandbox:
   vibe skill test ./skills/db-cleaner
   Runs attack payloads testing path traversal, SSRF, and destructive write locks.

6. Install skill to agent clients:
   vibe skill install ./skills/db-cleaner
   One-command installation into Claude Desktop, Antigravity, Cursor,
   OpenCode (opencode.json), Nous Hermes (~/.hermes/skills/),
   Goose (config.yaml), Claude Code (.claude/mcp.json), and OpenHands.

7. Route natural language to tools:
   vibe route "purge expired user sessions"
   Or run as a persistent stdio MCP multiplexer for agent clients:
   vibe route --server
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
