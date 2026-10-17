import path from 'path';
import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from './config.js';
import { linkCommand } from './commands/link.js';
import { scanCommand } from './commands/scan.js';
import { initCommand } from './commands/init.js';
import { vaultCreateCommand, vaultListCommand, vaultSwitchCommand } from './commands/vault.js';
import { syncCommand } from './commands/sync.js';
import { watchCommand } from './commands/watch.js';
import { devCommand } from './commands/dev.js';
import { checkCommand } from './commands/check.js';
import { snapCommand } from './commands/snap.js';
import { wrapupCommand } from './commands/wrapup.js';
import { showcaseCommand } from './commands/showcase.js';
import { doctorCommand } from './commands/doctor.js';
import { auditCommand } from './commands/audit.js';
import { promptCommand } from './commands/prompt.js';
import { specCommand } from './commands/spec.js';
import { routeCommand } from './commands/route.js';
import { clarifyCommand } from './commands/clarify.js';
import { shipCommand } from './commands/ship.js';
import { checkpointCommand, rollbackCommand } from './commands/checkpoint.js';
import { mapCommand } from './commands/map.js';
import { monetizeCommand } from './commands/monetize.js';
import { mockCommand } from './commands/mock.js';
import { dbCommand } from './commands/db.js';
import { packCommand } from './commands/pack.js';
import { commitCommand } from './commands/commit.js';
import { envCommand } from './commands/env.js';
import { canvasCommand } from './commands/canvas.js';
import { triageCommand } from './commands/triage.js';
import { apiCommand } from './commands/api.js';
import { depsCommand } from './commands/deps.js';
import {
  skillCompileCommand,
  skillCreateCommand,
  skillListCommand,
  skillTestCommand,
  skillInstallCommand,
  skillFromApiCommand,
  skillAuditCommand,
} from './commands/skill.js';

export function renderProBanner(): void {
  const banner = `
  ${pc.cyan('██╗   ██╗██╗██████╗ ███████╗')}     ${pc.magenta('██████╗██╗     ██╗')}
  ${pc.cyan('██║   ██║██║██╔══██╗██╔════╝')}    ${pc.magenta('██╔════╝██║     ██║')}
  ${pc.cyan('██║   ██║██║██████╔╝█████╗  ')}    ${pc.magenta('██║     ██║     ██║')}
  ${pc.cyan('╚██╗ ██╔╝██║██╔══██╗██╔══╝  ')}    ${pc.magenta('██║     ██║     ██║')}
   ${pc.cyan('╚████╔╝ ██║██████╔╝███████╗')}    ${pc.magenta('╚██████╗███████╗██║')}
    ${pc.cyan('╚═══╝  ╚═╝╚═════╝ ╚══════╝')}     ${pc.magenta('╚═════╝╚══════╝╚═╝')}
  ${pc.bold(pc.white('⚡ PRODUCTION VIBE CODING ENGINE'))} • ${pc.green('MULTI-VAULT OBSIDIAN HUB')}
  `.trim();
  console.log('\n' + banner + '\n');
}

export async function interactiveMainMenu(): Promise<void> {
  renderProBanner();

  const config = loadConfig();
  const cwdName = path.basename(process.cwd());
  const vaultName = config.defaultVault;
  const projectCount = config.registeredProjects.length;

  p.note(
    `Directory:   ${pc.bold(pc.white(cwdName))} (${pc.dim(process.cwd())})\n` +
      `Active Vault: ${pc.bold(pc.cyan('💎 ' + vaultName))}\n` +
      `Ecosystem:    ${pc.yellow(String(projectCount))} linked project(s) ready for AI orchestration`,
    'Status Dashboard'
  );

  const category = await p.select({
    message: 'Select Workspace Category (Use ↑/↓, Enter to select):',
    options: [
      {
        value: 'daily',
        label: '🚀 Daily Flow & Codebase',
        hint: 'Dev, Check, Triage, Snap gotchas, Wrapup, Checkpoints',
      },
      {
        value: 'ai',
        label: '🧠 AI Architecture & Prompting',
        hint: 'Feature Clarify, PRD Spec, Master Prompt, Context Pack, 2D Canvas',
      },
      {
        value: 'topology',
        label: '🗺️ Codebase & Data Topology',
        hint: 'Module AST Map, Database ER Diagram, OpenAPI 3.0 Exporter',
      },
      {
        value: 'commercial',
        label: '🚢 Commercial Launch & Revenue',
        hint: 'Ship Gate, Stripe Monetize, Mock API Server, Env Sentinel, Commit, Deps, Audit',
      },
      {
        value: 'skills',
        label: '⚡ AI Agent Skills & Obsidian Hub',
        hint: 'OmniRoute Switchboard, Skill Compiler, Vault Manager, Link, Scan, Sync, Doctor',
      },
    ],
  });

  if (p.isCancel(category)) {
    p.cancel('Goodbye!');
    return;
  }

  if (category === 'daily') {
    const act = await p.select({
      message: 'Daily Flow Action:',
      options: [
        { value: 'dev', label: '🚀 Launch Dev Server (vibe dev)', hint: 'Runs auto-detected dev server' },
        { value: 'check', label: '✅ Verify Codebase (vibe check)', hint: 'Runs tests and builds' },
        { value: 'triage', label: '🩺 AI Failure Triage & Self-Healing (vibe triage)', hint: 'Extracts error stack & copies surgical fix prompt' },
        { value: 'checkpoint', label: '💾 Time-Machine Checkpoint (vibe checkpoint)', hint: 'Instant workspace snapshot before AI edits' },
        { value: 'rollback', label: '⏪ Rollback Workspace (vibe rollback)', hint: 'Restore previous stable checkpoint' },
        { value: 'snap', label: '🧠 Snap a Lesson / Gotcha (vibe snap)', hint: 'Log insight into Obsidian Memory Bank' },
        { value: 'wrapup', label: '📦 Wrap Up Session (vibe wrapup)', hint: 'Archive completed tasks and prune context' },
      ],
    });
    if (p.isCancel(act)) return;
    if (act === 'dev') await devCommand();
    if (act === 'check') await checkCommand();
    if (act === 'triage') await triageCommand();
    if (act === 'checkpoint') await checkpointCommand();
    if (act === 'rollback') await rollbackCommand();
    if (act === 'snap') await snapCommand();
    if (act === 'wrapup') await wrapupCommand();
    return;
  }

  if (category === 'ai') {
    const act = await p.select({
      message: 'AI Architecture Action:',
      options: [
        { value: 'clarify', label: '🧠 Architect Feature Interview (vibe clarify)', hint: '5-pillar interview locking down PRD' },
        { value: 'spec', label: '📐 Architect Feature PRD & Spec (vibe spec)', hint: 'Generate feature blueprint in Obsidian' },
        { value: 'prompt', label: '📋 Generate AI Master Prompt (vibe prompt)', hint: 'Synthesize context & copy anti-slop prompt' },
        { value: 'pack', label: '🪶 Token-Optimized Context Packer (vibe pack)', hint: 'Compress AST signatures to clipboard' },
        { value: 'canvas', label: '🎨 Native Obsidian Visual Canvas (vibe canvas)', hint: 'Generate 2D interactive whiteboard' },
      ],
    });
    if (p.isCancel(act)) return;
    if (act === 'clarify') await clarifyCommand();
    if (act === 'spec') await specCommand();
    if (act === 'prompt') await promptCommand();
    if (act === 'pack') await packCommand();
    if (act === 'canvas') await canvasCommand();
    return;
  }

  if (category === 'topology') {
    const act = await p.select({
      message: 'Codebase & Data Topology Action:',
      options: [
        { value: 'map', label: '🗺️ Codebase Topology & AST Grapher (vibe map)', hint: 'Extract module dependencies & Mermaid graph' },
        { value: 'db', label: '🗄️ Database & Schema Visualizer (vibe db)', hint: 'Generate living ER diagram in Obsidian' },
        { value: 'api', label: '🌐 OpenAPI 3.0 & cURL Exporter (vibe api)', hint: 'Export OpenAPI JSON & Markdown API docs' },
      ],
    });
    if (p.isCancel(act)) return;
    if (act === 'map') await mapCommand();
    if (act === 'db') await dbCommand();
    if (act === 'api') await apiCommand();
    return;
  }

  if (category === 'commercial') {
    const act = await p.select({
      message: 'Commercial & Shipping Action:',
      options: [
        { value: 'ship', label: '🚢 Launchpad & Commercial Ship Gate (vibe ship)', hint: 'Verify secrets, GDPR legal suite & CI/CD' },
        { value: 'monetize', label: '💳 Scaffold Stripe Billing (vibe monetize)', hint: 'Stripe checkout, webhooks & pricing table' },
        { value: 'mock', label: '🧪 Mock REST API Server (vibe mock)', hint: 'Zero-dependency local HTTP API server' },
        { value: 'env', label: '🔒 Environment & Secret Sentinel (vibe env)', hint: 'Diff .env vs .env.example & shield leaks' },
        { value: 'commit', label: '📝 Semantic Conventional Commit (vibe commit)', hint: 'Analyze diff & write conventional commits' },
        { value: 'deps', label: '📦 Dependency & Vulnerability Audit (vibe deps)', hint: 'Scan for CVEs & outdated packages' },
        { value: 'audit', label: '🛡️  Commercial & Production Readiness Audit (vibe audit)', hint: 'Score readiness across security & payments' },
      ],
    });
    if (p.isCancel(act)) return;
    if (act === 'ship') await shipCommand();
    if (act === 'monetize') await monetizeCommand();
    if (act === 'mock') await mockCommand();
    if (act === 'env') await envCommand();
    if (act === 'commit') await commitCommand();
    if (act === 'deps') await depsCommand();
    if (act === 'audit') await auditCommand();
    return;
  }

  if (category === 'skills') {
    const act = await p.select({
      message: 'AI Skills & Ecosystem Action:',
      options: [
        { value: 'route', label: '🧭 OmniRoute AI Tool Switchboard (vibe route)', hint: 'Universal gateway & semantic intent dispatcher' },
        { value: 'skill', label: '⚡ Multi-Target AI Skill Compiler (vibe skill)', hint: 'Compile, test, install, or audit AI skills' },
        { value: 'link', label: '🔗 Link Project to Obsidian (vibe link)', hint: 'Auto-detect stack, wire junctions, generate notes' },
        { value: 'scan', label: '🔍 Bulk Scan Projects Directory (vibe scan)', hint: 'Find unlinked projects and batch-wire them' },
        { value: 'vault', label: '📂 Manage Obsidian Vaults (vibe vault)', hint: 'Create, list, or switch vaults' },
        { value: 'sync', label: '🔄 Sync Junctions & Portfolio (vibe sync)', hint: 'Heal broken links and publish showcase projects' },
        { value: 'doctor', label: '🩺 Run Health Diagnostic (vibe doctor)', hint: 'Check toolchain and environment health' },
      ],
    });
    if (p.isCancel(act)) return;
    if (act === 'route') await routeCommand();
    if (act === 'link') await linkCommand();
    if (act === 'scan') await scanCommand();
    if (act === 'sync') await syncCommand();
    if (act === 'doctor') await doctorCommand();
    if (act === 'vault') {
      const vaultAction = await p.select({
        message: 'Obsidian Vault Action:',
        options: [
          { value: 'list', label: '📋 List Vaults & Linked Projects' },
          { value: 'create', label: '➕ Create a Brand New Vault' },
          { value: 'browse', label: '🔍 Browse & Register Existing Vault on PC (GUI)' },
          { value: 'switch', label: '⭐ Switch Active Default Vault' },
        ],
      });
      if (p.isCancel(vaultAction)) return;
      if (vaultAction === 'list') await vaultListCommand();
      if (vaultAction === 'create') await vaultCreateCommand();
      if (vaultAction === 'browse') await vaultCreateCommand(undefined, { browse: true });
      if (vaultAction === 'switch') await vaultSwitchCommand();
    }
    if (act === 'skill') {
      const skillAction = await p.select({
        message: 'AI Agent Skill Action:',
        options: [
          { value: 'compile', label: '📦 Compile Script into AI Agent Skills (Antigravity/MCP/Cursor)' },
          { value: 'create', label: '✨ Synthesize AI Skill from Natural Language Intent' },
          { value: 'from-api', label: '🌐 Ingest REST API / OpenAPI Specification into AI Tools' },
          { value: 'test', label: '🛡️  Run Sandbox Safety & Attack Verification Suite' },
          { value: 'install', label: '🔌 1-Click Install to Claude Desktop, Antigravity & Cursor' },
          { value: 'audit', label: '🔍 Audit Skill Security, Schemas & Guardrails' },
          { value: 'list', label: '📋 List Installed Skills & Active Targets' },
        ],
      });
      if (p.isCancel(skillAction)) return;
      if (skillAction === 'compile') await skillCompileCommand();
      if (skillAction === 'create') await skillCreateCommand();
      if (skillAction === 'from-api') await skillFromApiCommand();
      if (skillAction === 'test') await skillTestCommand();
      if (skillAction === 'install') await skillInstallCommand();
      if (skillAction === 'audit') await skillAuditCommand();
      if (skillAction === 'list') await skillListCommand();
    }
    return;
  }
}

const program = new Command();

program
  .name('vibe')
  .description('Automated Multi-Vault Obsidian Orchestrator, Auto-Discovery Engine & Vibe Coding Assistant')
  .version('1.1.0');

// Default action when run with no arguments: open interactive main menu
program.action(async () => {
  await interactiveMainMenu();
});

// 1. vibe link
program
  .command('link')
  .description('Auto-detect and wire a project codebase to an Obsidian Vault')
  .argument('[targetPath]', 'Path to the project folder to wire (optional)')
  .option('-b, --browse', 'Browse for project folder with native Windows GUI dialog')
  .option('-v, --vault <vaultName>', 'Target Obsidian Vault name')
  .option('-s, --showcase', 'Mark project as showcase for portfolio')
  .option('-f, --force', 'Force overwrite of existing notes')
  .action(async (targetPath, options) => {
    await linkCommand(targetPath, options);
  });

// 2. vibe scan
program
  .command('scan')
  .description('Scan a parent directory for unlinked projects and batch-wire them')
  .argument('[rootDir]', 'Root directory to scan (defaults to configured projectsRoot)')
  .option('-b, --browse', 'Browse for directory to scan with native Windows GUI dialog')
  .option('-a, --all', 'Wire all unlinked projects without prompting')
  .option('-v, --vault <vaultName>', 'Target Obsidian Vault name')
  .option('-f, --force', 'Force overwrite of existing notes')
  .action(async (rootDir, options) => {
    await scanCommand(rootDir, options);
  });

// 3. vibe init
program
  .command('init')
  .description('Scaffold a new project directory and wire it to Obsidian')
  .argument('[projectName]', 'Name of the project to create')
  .option('-b, --browse', 'Select parent directory with native Windows GUI dialog')
  .option('-v, --vault <vaultName>', 'Target Obsidian Vault name')
  .action(async (projectName, options) => {
    await initCommand(projectName, options);
  });

// Shortcut: vibe new-vault
program
  .command('new-vault [vaultName]')
  .description('Shortcut: Scaffold and register a new Obsidian Vault')
  .option('-p, --path <path>', 'Custom directory path for vault')
  .option('-b, --browse', 'Browse for vault folder with native Windows GUI dialog')
  .option('-u, --use', 'Set this new vault as the default')
  .action(async (vaultName, options) => {
    await vaultCreateCommand(vaultName, options);
  });

// 4. vibe vault
const vaultCmd = program.command('vault').description('Manage Obsidian Vaults');

vaultCmd
  .command('create')
  .description('Create and register a new Obsidian Vault')
  .argument('[vaultName]', 'Name of the vault')
  .option('-p, --path <path>', 'Custom directory path for vault')
  .option('-b, --browse', 'Browse for vault folder with native Windows GUI dialog')
  .option('-u, --use', 'Set this new vault as the default')
  .action(async (vaultName, options) => {
    await vaultCreateCommand(vaultName, options);
  });

vaultCmd
  .command('list')
  .description('List all registered Obsidian Vaults and bound projects')
  .action(async () => {
    await vaultListCommand();
  });

vaultCmd
  .command('switch')
  .description('Switch the active default Obsidian Vault')
  .argument('[vaultName]', 'Name of the vault to set as default')
  .action(async (vaultName) => {
    await vaultSwitchCommand(vaultName);
  });

// 5. vibe prompt
program
  .command('prompt')
  .description('Synthesize codebase context & copy high-grade master prompt to clipboard')
  .argument('[task...]', 'Description of feature or task for AI agent')
  .action(async (taskParts) => {
    const task = taskParts && taskParts.length > 0 ? taskParts.join(' ') : undefined;
    await promptCommand(task);
  });

// 6. vibe spec
program
  .command('spec')
  .description('Generate a production-grade Feature PRD in Obsidian Specs')
  .argument('[featureName...]', 'Name of feature to architect')
  .action(async (featureParts) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await specCommand(feature);
  });

// 7. vibe audit
program
  .command('audit')
  .description('Run commercial readiness & quality audit (security, payments, UX, observability)')
  .argument('[targetDir]', 'Project directory to audit (defaults to current dir)')
  .action(async (targetDir) => {
    await auditCommand(targetDir);
  });

// 8. vibe dev
program
  .command('dev')
  .description('Launch the auto-detected development server (npm, dotnet watch, artisan, flutter)')
  .action(async () => {
    await devCommand();
  });

// 9. vibe check
program
  .command('check')
  .description('Run the auto-detected verification suite for the current project')
  .action(async () => {
    await checkCommand();
  });

// 10. vibe snap
program
  .command('snap')
  .description('Quickly log an architectural decision or lesson learned to Obsidian Memory Bank')
  .argument('[message...]', 'Note or gotcha message to record')
  .action(async (messageParts) => {
    const message = messageParts && messageParts.length > 0 ? messageParts.join(' ') : undefined;
    await snapCommand(message);
  });

// 11. vibe wrapup
program
  .command('wrapup')
  .description('Archive completed tasks from _Context.md to Memory Bank and prune to <= 60 lines')
  .action(async () => {
    await wrapupCommand();
  });

// 12. vibe showcase
program
  .command('showcase')
  .description('Toggle or set showcase status for current project in portfolio')
  .argument('[state]', 'on | off')
  .action(async (state) => {
    await showcaseCommand(state);
  });

// 13. vibe sync
program
  .command('sync')
  .description('Audit/repair NTFS directory junctions and publish showcase projects to portfolio')
  .action(async () => {
    await syncCommand();
  });

// 14. vibe watch
program
  .command('watch')
  .description('Live daemon watching Obsidian vault changes and auto-linking new project folders')
  .option('-a, --auto-link', 'Automatically detect and wire newly created project folders in projectsRoot')
  .action(async (options) => {
    await watchCommand(options);
  });

// 15. vibe doctor
program
  .command('doctor')
  .description('Multi-platform toolchain and environment diagnostic for vibe coding')
  .action(async () => {
    await doctorCommand();
  });

// 16. vibe skill (Multi-Target Compiler & Guardrails)
const skillCmd = program
  .command('skill')
  .description('Multi-target AI agent skill & MCP compiler with deterministic guardrails');

skillCmd
  .command('compile')
  .description('Compile a Python, TypeScript, JS, or JSON script into multi-target AI skills')
  .argument('[filePath]', 'Path to the source script')
  .option('-t, --target <target>', 'Target output: antigravity | mcp | cursor | openai | all', 'all')
  .option('-o, --out <dir>', 'Custom output directory')
  .option('-b, --browse', 'Browse for source script with native Windows GUI dialog')
  .option('-s, --save-vault', 'Save and index directly into current project Obsidian vault (.vault/Skills/)')
  .action(async (filePath, options) => {
    await skillCompileCommand(filePath, options);
  });

skillCmd
  .command('create')
  .description('Synthesize an AI agent skill suite from a natural language intent')
  .argument('[intent...]', 'Description of the skill/tool behavior')
  .option('-t, --target <target>', 'Target output: antigravity | mcp | cursor | openai | all', 'all')
  .option('-o, --out <dir>', 'Custom output directory')
  .action(async (intentParts, options) => {
    const intent = intentParts && intentParts.length > 0 ? intentParts.join(' ') : undefined;
    await skillCreateCommand(intent, options);
  });

skillCmd
  .command('list')
  .description('List installed AI agent skills and their active compilation targets')
  .action(async () => {
    await skillListCommand();
  });

skillCmd
  .command('test')
  .description('Run automated safety sandbox and attack verification tests on a skill')
  .argument('[skillDir]', 'Path to the compiled skill folder')
  .action(async (skillDir) => {
    await skillTestCommand(skillDir);
  });

skillCmd
  .command('install')
  .description('1-click wire-up of skill into Claude Desktop, Antigravity, and Cursor')
  .argument('[skillDir]', 'Path to the compiled skill folder')
  .option('-a, --all', 'Install to all available client environments without prompting')
  .action(async (skillDir, options) => {
    await skillInstallCommand(skillDir, options);
  });

skillCmd
  .command('from-api')
  .description('Ingest OpenAPI/Swagger JSON or URL and compile guarded AI agent tools')
  .argument('[specPathOrUrl]', 'Path or URL to OpenAPI / Swagger JSON specification')
  .option('-t, --target <target>', 'Target output: antigravity | mcp | cursor | openai | all', 'all')
  .option('-o, --out <dir>', 'Custom output directory')
  .option('-b, --browse', 'Browse for specification file with native Windows GUI dialog')
  .action(async (specPathOrUrl, options) => {
    await skillFromApiCommand(specPathOrUrl, options);
  });

skillCmd
  .command('audit')
  .description('Run static security, schema quality, and guardrail audit on a skill')
  .argument('[skillDir]', 'Path to the compiled skill folder or manifest')
  .action(async (skillDir) => {
    await skillAuditCommand(skillDir);
  });

// 17. vibe clarify
program
  .command('clarify')
  .description('Interactive Principal Architect interview to eliminate vague requirements & output locked PRD')
  .argument('[featureName...]', 'Feature or module to clarify')
  .action(async (featureParts) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await clarifyCommand(feature);
  });

// 18. vibe ship
program
  .command('ship')
  .description('Commercial launch gate & launchpad (secrets, GDPR legal suite, SEO, CI/CD, verification)')
  .argument('[targetDir]', 'Project directory to audit for launch (defaults to current dir)')
  .action(async (targetDir) => {
    await shipCommand(targetDir);
  });

// 19. vibe route
program
  .command('route')
  .description('OmniRoute Universal AI Tool Gateway & semantic intent dispatcher')
  .argument('[intent...]', 'Task or intent to route to installed AI skills')
  .option('-s, --server', 'Run OmniRoute as a stdio MCP Server multiplexer')
  .option('-d, --dry-run', 'Preview matched tools without executing')
  .action(async (intentParts, options) => {
    const intent = intentParts && intentParts.length > 0 ? intentParts.join(' ') : undefined;
    await routeCommand(intent, options);
  });

// 20. vibe checkpoint
program
  .command('checkpoint')
  .description('Create an instant time-machine snapshot before AI agent edits')
  .argument('[label...]', 'Checkpoint label or description')
  .option('-l, --list', 'List stored checkpoints')
  .action(async (labelParts, options) => {
    const label = labelParts && labelParts.length > 0 ? labelParts.join(' ') : undefined;
    await checkpointCommand(label, options);
  });

// 21. vibe rollback
program
  .command('rollback')
  .description('Restore workspace files to a previous stable checkpoint')
  .argument('[checkpointId]', 'ID of checkpoint to restore')
  .action(async (checkpointId) => {
    await rollbackCommand(checkpointId);
  });

// 22. vibe map
program
  .command('map')
  .description('Extract codebase topology, AST exports, module dependencies, and API routes')
  .argument('[targetDir]', 'Target project directory to analyze (defaults to current dir)')
  .action(async (targetDir) => {
    await mapCommand(targetDir);
  });

// 23. vibe monetize
program
  .command('monetize')
  .description('Scaffold complete commercial Stripe subscriptions, webhooks, and pricing table')
  .argument('[targetDir]', 'Target project directory to scaffold (defaults to current dir)')
  .action(async (targetDir) => {
    await monetizeCommand(targetDir);
  });

// 24. vibe mock
program
  .command('mock')
  .description('Launch instant zero-dependency local REST mock API server with CORS and latency simulation')
  .argument('[dataFile]', 'Optional JSON data or OpenAPI file to seed mock endpoints')
  .option('-p, --port <port>', 'Port number to listen on', '4000')
  .option('-d, --delay <delayMs>', 'Simulated network latency in milliseconds', '0')
  .option('-c, --chaos <rate>', 'Chaos error simulation rate (0.0 - 1.0)', '0')
  .action(async (dataFile, options) => {
    await mockCommand(dataFile, {
      port: parseInt(options.port, 10),
      delay: parseInt(options.delay, 10),
      chaos: parseFloat(options.chaos),
    });
  });

// 25. vibe db
program
  .command('db')
  .description('Parse database schema (Prisma/SQL), generate ER diagram, and write table dictionary')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .action(async (targetDir) => {
    await dbCommand(targetDir);
  });

// 26. vibe pack
program
  .command('pack')
  .description('Compress source code into token-optimized AST signatures and copy dense context to clipboard')
  .argument('[targetPattern]', 'File pattern or subdirectory to pack')
  .option('-s, --signatures-only', 'Extract only exports, interfaces, and function signatures')
  .option('-o, --out <file>', 'Custom output file path')
  .action(async (targetPattern, options) => {
    await packCommand(targetPattern, options);
  });

// 27. vibe commit
program
  .command('commit')
  .description('Analyze git diff, generate conventional commit proposal, and update CHANGELOG.md')
  .argument('[message...]', 'Optional commit message')
  .action(async (messageParts) => {
    const message = messageParts && messageParts.length > 0 ? messageParts.join(' ') : undefined;
    await commitCommand(message);
  });

// 28. vibe env
program
  .command('env')
  .description('Audit environment files (.env vs .env.example), detect secret leaks, and sync keys')
  .option('-s, --sync', 'Automatically add missing keys to .env.example with placeholders')
  .option('-c, --check', 'CI verification mode: exit with error if secrets leaked or unignored')
  .action(async (options) => {
    await envCommand(options);
  });

// 29. vibe canvas
program
  .command('canvas')
  .description('Generate native Obsidian 2D visual canvas connecting project hub, tasks, and architecture')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .action(async (targetDir) => {
    await canvasCommand(targetDir);
  });

// 30. vibe triage
program
  .command('triage')
  .description('Run verification suite, capture stack traces, and synthesize surgical fix prompts')
  .argument('[customCommand]', 'Optional verification command to execute')
  .action(async (customCommand) => {
    await triageCommand(customCommand);
  });

// 31. vibe api
program
  .command('api')
  .description('Export discovered API routes to OpenAPI 3.0 specification and Markdown cURL catalog')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .option('-o, --out <file>', 'Custom output path for openapi.json')
  .action(async (targetDir, options) => {
    await apiCommand(targetDir, options);
  });

// 32. vibe deps
program
  .command('deps')
  .description('Audit cross-platform dependencies, scan for vulnerabilities, and check outdated packages')
  .option('-f, --fix', 'Automatically run safe security vulnerability remediation')
  .action(async (options) => {
    await depsCommand(options);
  });

program.parse();
