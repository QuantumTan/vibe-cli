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
import { guideCommand } from './commands/guide.js';
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
  console.log(`\n  ${pc.bold('vibe')} ${pc.dim('v1.1.0')} ${pc.dim('·')} ${pc.dim('workspace & vault manager')}`);
}

export async function interactiveMainMenu(): Promise<void> {
  const config = loadConfig();
  const cwdName = path.basename(process.cwd());
  const vaultName = config.defaultVault;
  const projectCount = config.registeredProjects.length;

  renderProBanner();
  console.log(
    `  ${pc.dim('dir:')} ${cwdName}  ${pc.dim('|')}  ${pc.dim('vault:')} ${vaultName}  ${pc.dim('|')}  ${pc.dim('projects:')} ${projectCount} linked\n`
  );

  while (true) {
    const action = await p.select({
      message: 'Action or workspace:',
      options: [
        { value: 'dev', label: 'Dev server', hint: 'vibe dev' },
        { value: 'check', label: 'Verify build & tests', hint: 'vibe check' },
        { value: 'triage', label: 'Triage failure', hint: 'vibe triage' },
        { value: 'snap', label: 'Log lesson note', hint: 'vibe snap' },
        { value: 'wrapup', label: 'Wrap up session', hint: 'vibe wrapup' },
        { value: 'link', label: 'Link project to vault', hint: 'vibe link' },
        { value: 'ai', label: 'Architecture & specs...', hint: 'clarify, spec, prompt, pack, canvas' },
        { value: 'topology', label: 'Topology & schemas...', hint: 'map, db, api' },
        { value: 'commercial', label: 'Launch & payments...', hint: 'ship, monetize, mock, env, deps' },
        { value: 'skills', label: 'Skills & ecosystem...', hint: 'route, skill, scan, doctor' },
        { value: 'guide', label: 'Usage guides & workflows...', hint: 'vibe guide' },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      p.outro('Done.');
      return;
    }

    if (action === 'dev') { await devCommand(); return; }
    if (action === 'check') { await checkCommand(); return; }
    if (action === 'triage') { await triageCommand(); return; }
    if (action === 'snap') { await snapCommand(); return; }
    if (action === 'wrapup') { await wrapupCommand(); return; }
    if (action === 'link') { await linkCommand(); return; }
    if (action === 'guide') { await guideCommand(); continue; }

    if (action === 'ai') {
      const sub = await p.select({
        message: 'Architecture & specs:',
        options: [
          { value: 'clarify', label: 'Feature clarify interview', hint: 'vibe clarify' },
          { value: 'spec', label: 'Generate feature spec', hint: 'vibe spec' },
          { value: 'prompt', label: 'Generate context prompt', hint: 'vibe prompt' },
          { value: 'pack', label: 'Pack context signatures', hint: 'vibe pack' },
          { value: 'canvas', label: 'Generate visual canvas', hint: 'vibe canvas' },
          { value: 'checkpoint', label: 'Create snapshot checkpoint', hint: 'vibe checkpoint' },
          { value: 'rollback', label: 'Rollback to checkpoint', hint: 'vibe rollback' },
          { value: 'back', label: 'Back to main menu' },
        ],
      });
      if (p.isCancel(sub) || sub === 'back') continue;
      if (sub === 'clarify') { await clarifyCommand(); return; }
      if (sub === 'spec') { await specCommand(); return; }
      if (sub === 'prompt') { await promptCommand(); return; }
      if (sub === 'pack') { await packCommand(); return; }
      if (sub === 'canvas') { await canvasCommand(); return; }
      if (sub === 'checkpoint') { await checkpointCommand(); return; }
      if (sub === 'rollback') { await rollbackCommand(); return; }
    }

    if (action === 'topology') {
      const sub = await p.select({
        message: 'Topology & schemas:',
        options: [
          { value: 'map', label: 'Extract dependency map', hint: 'vibe map' },
          { value: 'db', label: 'Parse database schema', hint: 'vibe db' },
          { value: 'api', label: 'Export OpenAPI specification', hint: 'vibe api' },
          { value: 'back', label: 'Back to main menu' },
        ],
      });
      if (p.isCancel(sub) || sub === 'back') continue;
      if (sub === 'map') { await mapCommand(); return; }
      if (sub === 'db') { await dbCommand(); return; }
      if (sub === 'api') { await apiCommand(); return; }
    }

    if (action === 'commercial') {
      const sub = await p.select({
        message: 'Launch & payments:',
        options: [
          { value: 'ship', label: 'Pre-flight release checks', hint: 'vibe ship' },
          { value: 'monetize', label: 'Scaffold Stripe billing', hint: 'vibe monetize' },
          { value: 'mock', label: 'Start local mock API', hint: 'vibe mock' },
          { value: 'env', label: 'Check environment variables', hint: 'vibe env' },
          { value: 'commit', label: 'Create conventional commit', hint: 'vibe commit' },
          { value: 'deps', label: 'Audit dependencies & CVEs', hint: 'vibe deps' },
          { value: 'audit', label: 'Run readiness audit', hint: 'vibe audit' },
          { value: 'back', label: 'Back to main menu' },
        ],
      });
      if (p.isCancel(sub) || sub === 'back') continue;
      if (sub === 'ship') { await shipCommand(); return; }
      if (sub === 'monetize') { await monetizeCommand(); return; }
      if (sub === 'mock') { await mockCommand(); return; }
      if (sub === 'env') { await envCommand(); return; }
      if (sub === 'commit') { await commitCommand(); return; }
      if (sub === 'deps') { await depsCommand(); return; }
      if (sub === 'audit') { await auditCommand(); return; }
    }

    if (action === 'skills') {
      const sub = await p.select({
        message: 'Skills & ecosystem:',
        options: [
          { value: 'route', label: 'Route intent to tool', hint: 'vibe route' },
          { value: 'skill', label: 'Manage skills...', hint: 'vibe skill' },
          { value: 'scan', label: 'Scan directory for projects', hint: 'vibe scan' },
          { value: 'vault', label: 'Manage vaults...', hint: 'vibe vault' },
          { value: 'sync', label: 'Sync junctions & portfolio', hint: 'vibe sync' },
          { value: 'doctor', label: 'Run environment diagnostic', hint: 'vibe doctor' },
          { value: 'back', label: 'Back to main menu' },
        ],
      });
      if (p.isCancel(sub) || sub === 'back') continue;
      if (sub === 'route') { await routeCommand(); return; }
      if (sub === 'scan') { await scanCommand(); return; }
      if (sub === 'sync') { await syncCommand(); return; }
      if (sub === 'doctor') { await doctorCommand(); return; }

      if (sub === 'vault') {
        const vaultAction = await p.select({
          message: 'Vault action:',
          options: [
            { value: 'list', label: 'List vaults & linked projects' },
            { value: 'create', label: 'Create new vault' },
            { value: 'browse', label: 'Browse for existing vault' },
            { value: 'switch', label: 'Set default vault' },
            { value: 'back', label: 'Back' },
          ],
        });
        if (p.isCancel(vaultAction) || vaultAction === 'back') continue;
        if (vaultAction === 'list') { await vaultListCommand(); return; }
        if (vaultAction === 'create') { await vaultCreateCommand(); return; }
        if (vaultAction === 'browse') { await vaultCreateCommand(undefined, { browse: true }); return; }
        if (vaultAction === 'switch') { await vaultSwitchCommand(); return; }
      }

      if (sub === 'skill') {
        const skillAction = await p.select({
          message: 'Skill action:',
          options: [
            { value: 'compile', label: 'Compile script into skill' },
            { value: 'create', label: 'Create skill from description' },
            { value: 'from-api', label: 'Generate tools from OpenAPI spec' },
            { value: 'test', label: 'Run sandbox safety tests' },
            { value: 'install', label: 'Install skill to agent configs' },
            { value: 'audit', label: 'Audit skill definition' },
            { value: 'list', label: 'List installed skills' },
            { value: 'back', label: 'Back' },
          ],
        });
        if (p.isCancel(skillAction) || skillAction === 'back') continue;
        if (skillAction === 'compile') { await skillCompileCommand(); return; }
        if (skillAction === 'create') { await skillCreateCommand(); return; }
        if (skillAction === 'from-api') { await skillFromApiCommand(); return; }
        if (skillAction === 'test') { await skillTestCommand(); return; }
        if (skillAction === 'install') { await skillInstallCommand(); return; }
        if (skillAction === 'audit') { await skillAuditCommand(); return; }
        if (skillAction === 'list') { await skillListCommand(); return; }
      }
    }
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

program
  .command('init')
  .description('Scaffold a new project directory and wire it to Obsidian')
  .argument('[projectName]', 'Name of the project to create')
  .option('-b, --browse', 'Select parent directory with native Windows GUI dialog')
  .option('-v, --vault <vaultName>', 'Target Obsidian Vault name')
  .action(async (projectName, options) => {
    await initCommand(projectName, options);
  });

program
  .command('new-vault [vaultName]')
  .description('Shortcut: Scaffold and register a new Obsidian Vault')
  .option('-p, --path <path>', 'Custom directory path for vault')
  .option('-b, --browse', 'Browse for vault folder with native Windows GUI dialog')
  .option('-u, --use', 'Set this new vault as the default')
  .action(async (vaultName, options) => {
    await vaultCreateCommand(vaultName, options);
  });

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

program
  .command('prompt')
  .description('Synthesize codebase context & copy high-grade master prompt to clipboard')
  .argument('[task...]', 'Description of feature or task for AI agent')
  .action(async (taskParts) => {
    const task = taskParts && taskParts.length > 0 ? taskParts.join(' ') : undefined;
    await promptCommand(task);
  });

program
  .command('spec')
  .description('Generate a production-grade Feature PRD in Obsidian Specs')
  .argument('[featureName...]', 'Name of feature to architect')
  .action(async (featureParts) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await specCommand(feature);
  });

program
  .command('audit')
  .description('Run commercial readiness & quality audit (security, payments, UX, observability)')
  .argument('[targetDir]', 'Project directory to audit (defaults to current dir)')
  .action(async (targetDir) => {
    await auditCommand(targetDir);
  });

program
  .command('dev')
  .description('Launch the auto-detected development server (npm, dotnet watch, artisan, flutter)')
  .action(async () => {
    await devCommand();
  });

program
  .command('check')
  .description('Run the auto-detected verification suite for the current project')
  .action(async () => {
    await checkCommand();
  });

program
  .command('snap')
  .description('Quickly log an architectural decision or lesson learned to Obsidian Memory Bank')
  .argument('[message...]', 'Note or gotcha message to record')
  .action(async (messageParts) => {
    const message = messageParts && messageParts.length > 0 ? messageParts.join(' ') : undefined;
    await snapCommand(message);
  });

program
  .command('wrapup')
  .description('Archive completed tasks from _Context.md to Memory Bank and prune to <= 60 lines')
  .action(async () => {
    await wrapupCommand();
  });

program
  .command('showcase')
  .description('Toggle or set showcase status for current project in portfolio')
  .argument('[state]', 'on | off')
  .action(async (state) => {
    await showcaseCommand(state);
  });

program
  .command('sync')
  .description('Audit/repair NTFS directory junctions and publish showcase projects to portfolio')
  .action(async () => {
    await syncCommand();
  });

program
  .command('watch')
  .description('Live daemon watching Obsidian vault changes and auto-linking new project folders')
  .option('-a, --auto-link', 'Automatically detect and wire newly created project folders in projectsRoot')
  .action(async (options) => {
    await watchCommand(options);
  });

program
  .command('doctor')
  .description('Multi-platform toolchain and environment diagnostic for vibe coding')
  .action(async () => {
    await doctorCommand();
  });

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

program
  .command('clarify')
  .description('Interactive Principal Architect interview to eliminate vague requirements & output locked PRD')
  .argument('[featureName...]', 'Feature or module to clarify')
  .action(async (featureParts) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await clarifyCommand(feature);
  });

program
  .command('ship')
  .description('Commercial launch gate & launchpad (secrets, GDPR legal suite, SEO, CI/CD, verification)')
  .argument('[targetDir]', 'Project directory to audit for launch (defaults to current dir)')
  .action(async (targetDir) => {
    await shipCommand(targetDir);
  });

program
  .command('route')
  .description('OmniRoute Universal AI Tool Gateway & semantic intent dispatcher')
  .argument('[intent...]', 'Task or intent to route to installed AI skills (.vault/Skills/ or ./skills/)')
  .option('-s, --server', 'Run OmniRoute as a stdio MCP Server multiplexer')
  .option('-d, --dry-run', 'Preview matched tools without executing')
  .action(async (intentParts, options) => {
    const intent = intentParts && intentParts.length > 0 ? intentParts.join(' ') : undefined;
    await routeCommand(intent, options);
  });

program
  .command('checkpoint')
  .description('Create an instant time-machine snapshot before AI agent edits')
  .argument('[label...]', 'Checkpoint label or description')
  .option('-l, --list', 'List stored checkpoints')
  .action(async (labelParts, options) => {
    const label = labelParts && labelParts.length > 0 ? labelParts.join(' ') : undefined;
    await checkpointCommand(label, options);
  });

program
  .command('rollback')
  .description('Restore workspace files to a previous stable checkpoint')
  .argument('[checkpointId]', 'ID of checkpoint to restore')
  .action(async (checkpointId) => {
    await rollbackCommand(checkpointId);
  });

program
  .command('map')
  .description('Extract codebase topology, AST exports, module dependencies, and API routes')
  .argument('[targetDir]', 'Target project directory to analyze (defaults to current dir)')
  .action(async (targetDir) => {
    await mapCommand(targetDir);
  });

program
  .command('monetize')
  .description('Scaffold complete commercial Stripe subscriptions, webhooks, and pricing table')
  .argument('[targetDir]', 'Target project directory to scaffold (defaults to current dir)')
  .action(async (targetDir) => {
    await monetizeCommand(targetDir);
  });

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

program
  .command('db')
  .description('Parse database schema (Prisma/SQL), generate ER diagram, and write table dictionary')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .action(async (targetDir) => {
    await dbCommand(targetDir);
  });

program
  .command('pack')
  .description('Compress source code into token-optimized AST signatures and copy dense context to clipboard')
  .argument('[targetPattern]', 'File pattern or subdirectory to pack')
  .option('-s, --signatures-only', 'Extract only exports, interfaces, and function signatures')
  .option('-o, --out <file>', 'Custom output file path')
  .action(async (targetPattern, options) => {
    await packCommand(targetPattern, options);
  });

program
  .command('commit')
  .description('Analyze git diff, generate conventional commit proposal, and update CHANGELOG.md')
  .argument('[message...]', 'Optional commit message')
  .action(async (messageParts) => {
    const message = messageParts && messageParts.length > 0 ? messageParts.join(' ') : undefined;
    await commitCommand(message);
  });

program
  .command('env')
  .description('Audit environment files (.env vs .env.example), detect secret leaks, and sync keys')
  .option('-s, --sync', 'Automatically add missing keys to .env.example with placeholders')
  .option('-c, --check', 'CI verification mode: exit with error if secrets leaked or unignored')
  .action(async (options) => {
    await envCommand(options);
  });

program
  .command('canvas')
  .description('Generate native Obsidian 2D visual canvas connecting project hub, tasks, and architecture')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .action(async (targetDir) => {
    await canvasCommand(targetDir);
  });

program
  .command('triage')
  .description('Run verification suite, capture stack traces, and synthesize surgical fix prompts')
  .argument('[customCommand]', 'Optional verification command to execute')
  .action(async (customCommand) => {
    await triageCommand(customCommand);
  });

program
  .command('api')
  .description('Export discovered API routes to OpenAPI 3.0 specification and Markdown cURL catalog')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .option('-o, --out <file>', 'Custom output path for openapi.json')
  .action(async (targetDir, options) => {
    await apiCommand(targetDir, options);
  });

program
  .command('deps')
  .description('Audit cross-platform dependencies, scan for vulnerabilities, and check outdated packages')
  .option('-f, --fix', 'Automatically run safe security vulnerability remediation')
  .action(async (options) => {
    await depsCommand(options);
  });

program
  .command('guide')
  .description('View in-terminal usage guides and workflow documentation')
  .argument('[topic]', 'Topic: quickstart | daily | architecture | topology | launch | skills | all')
  .action(async (topic) => {
    await guideCommand(topic);
  });

program.parse();
