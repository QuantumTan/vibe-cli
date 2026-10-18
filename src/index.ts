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
import { rewindCommand } from './commands/rewind.js';
import { explainCommand, learnCommand } from './commands/explain.js';
import { healthCommand } from './commands/health.js';
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
import { rulesCommand } from './commands/rules.js';
import { tunnelCommand } from './commands/tunnel.js';
import { stateCommand, stateSaveCommand, stateRestoreCommand } from './commands/state.js';
import { quotaCommand } from './commands/quota.js';
import { modelsCommand } from './commands/models.js';
import { microCommand } from './commands/micro.js';
import { rubricCommand } from './commands/rubric.js';
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
  console.log(`\n  ${pc.bold('vibe')} ${pc.dim('v2.0.0')} ${pc.dim('·')} ${pc.green('zero-budget student edition')}`);
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
        { value: 'micro', label: 'Small-model micro-task loop', hint: 'vibe micro' },
        { value: 'pack', label: 'Pack context signatures (budget-capped)', hint: 'vibe pack' },
        { value: 'state', label: 'State & memory controller (save/restore)', hint: 'vibe state' },
        { value: 'quota', label: 'Free tier quota ledger', hint: 'vibe quota' },
        { value: 'explain', label: 'Explain changes & viva oral-defense', hint: 'vibe explain / learn' },
        { value: 'rubric', label: 'Academic assessment rubric', hint: 'vibe rubric' },
        { value: 'ship', label: 'Zero-credit-card student launch preflight', hint: 'vibe ship --free' },
        { value: 'link', label: 'Link project to vault (portable)', hint: 'vibe link' },
        { value: 'doctor', label: 'Hardware probe & local model doctor', hint: 'vibe doctor --student' },
        { value: 'more', label: 'More tools...', hint: 'spec, route, map, db, api, tunnel, guide' },
        { value: 'exit', label: 'Exit' },
      ],
    });

    if (p.isCancel(action) || action === 'exit') {
      p.outro('Done.');
      return;
    }

    if (action === 'dev') { await devCommand(); continue; }
    if (action === 'check') { await checkCommand(); continue; }
    if (action === 'micro') { await microCommand(); continue; }
    if (action === 'pack') { await packCommand(); continue; }
    if (action === 'state') { await stateCommand(); continue; }
    if (action === 'quota') { await quotaCommand(); continue; }
    if (action === 'explain') { await explainCommand(); continue; }
    if (action === 'rubric') { await rubricCommand(); continue; }
    if (action === 'ship') { await shipCommand(undefined, { free: true }); continue; }
    if (action === 'link') { await linkCommand(); continue; }
    if (action === 'doctor') { await doctorCommand({ student: true }); continue; }

    if (action === 'more') {
      const sub = await p.select({
        message: 'More tools & diagnostics:',
        options: [
          { value: 'spec', label: 'Architect feature spec (PRD / prompt)', hint: 'vibe spec' },
          { value: 'route', label: 'Route intent across skills', hint: 'vibe route' },
          { value: 'models', label: 'Verified free tier model matrix', hint: 'vibe models' },
          { value: 'map', label: 'Extract dependency architecture map', hint: 'vibe map' },
          { value: 'db', label: 'Parse database schema & ER diagram', hint: 'vibe db' },
          { value: 'api', label: 'Export OpenAPI specification', hint: 'vibe api' },
          { value: 'triage', label: 'Triage test/build failures', hint: 'vibe triage' },
          { value: 'tunnel', label: 'Instant public tunnel bridge', hint: 'vibe tunnel' },
          { value: 'env', label: 'Check environment secrets (.env)', hint: 'vibe env' },
          { value: 'commit', label: 'Create conventional commit', hint: 'vibe commit' },
          { value: 'wrapup', label: 'Wrap up session (<60 lines)', hint: 'vibe wrapup' },
          { value: 'guide', label: 'Usage guides & workflows', hint: 'vibe guide' },
          { value: 'back', label: 'Back to main menu' },
        ],
      });
      if (p.isCancel(sub) || sub === 'back') continue;
      if (sub === 'spec') { await specCommand(); continue; }
      if (sub === 'route') { await routeCommand(); continue; }
      if (sub === 'models') { await modelsCommand(); continue; }
      if (sub === 'map') { await mapCommand(); continue; }
      if (sub === 'db') { await dbCommand(); continue; }
      if (sub === 'api') { await apiCommand(); continue; }
      if (sub === 'triage') { await triageCommand(); continue; }
      if (sub === 'tunnel') { await tunnelCommand(); continue; }
      if (sub === 'env') { await envCommand(); continue; }
      if (sub === 'commit') { await commitCommand(); continue; }
      if (sub === 'wrapup') { await wrapupCommand(); continue; }
      if (sub === 'guide') { await guideCommand(); continue; }
    }
  }
}

const program = new Command();

program
  .name('vibe')
  .description('Universal AI Memory Bank & Context Orchestrator (Zero-Budget Student Edition)')
  .version('2.0.0');

// Default action when run with no arguments: open interactive main menu
program.action(async () => {
  await interactiveMainMenu();
});

// 1. Context & Routing
program
  .command('pack')
  .description('Budget-capped AST & diff context packer for token economy')
  .argument('[targetPattern]', 'File pattern or subdirectory to pack')
  .option('-b, --budget <tokens>', 'Context budget ceiling in tokens', '4000')
  .option('-d, --diff', 'Include git diff (HEAD) in Tier 1 context', true)
  .option('-e, --error-log <path>', 'Path to error log for stack-trace context slicing')
  .option('-c, --compress', 'Compress context by stripping comments and blank lines')
  .option('-s, --signatures-only', 'Extract only exports, interfaces, and function signatures')
  .option('-o, --out <file>', 'Custom output file path')
  .action(async (targetPattern, options) => {
    await packCommand(targetPattern, options);
  });

program
  .command('route')
  .description('OmniRoute Universal AI Tool Gateway & semantic intent dispatcher')
  .argument('[intent...]', 'Task or intent to route to installed AI skills (.vault/Skills/ or ./skills/)')
  .option('-s, --server', 'Run OmniRoute as a stdio MCP Server multiplexer')
  .option('-d, --dry-run', 'Preview matched tools without executing')
  .option('--status', 'Display free tier quota ledger table')
  .action(async (intentParts, options) => {
    const intent = intentParts && intentParts.length > 0 ? intentParts.join(' ') : undefined;
    await routeCommand(intent, options);
  });

program
  .command('quota')
  .description('Display zero-dollar free tier API quota ledger table')
  .action(async () => {
    await quotaCommand();
  });

program
  .command('models')
  .description('Display verified 2026 zero-credit-card free model matrix')
  .action(async () => {
    await modelsCommand();
  });

// 2. Execution & Guardrails
program
  .command('micro')
  .description('Small-model atomic micro-task decomposer with search-replace and verify loop')
  .argument('[task...]', 'Task description to decompose for 3B–8B models')
  .option('-v, --verify <cmd>', 'Verification command (default: tsc --noEmit)')
  .option('-f, --file <file>', 'Target file to patch')
  .option('-p, --patch <patch>', 'Search-replace patch file or text')
  .action(async (taskParts, options) => {
    const task = taskParts && taskParts.length > 0 ? taskParts.join(' ') : undefined;
    await microCommand(task, options);
  });

program
  .command('spec')
  .description('Generate a production-grade Feature PRD in Obsidian Specs')
  .argument('[featureName...]', 'Name of feature to architect')
  .option('-c, --clarify', 'Interactive architectural interview before generating PRD')
  .option('-p, --prompt', 'Synthesize codebase context and copy master prompt to clipboard')
  .action(async (featureParts, options) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await specCommand(feature, options);
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
  .command('dev')
  .description('Launch the auto-detected development server (npm, dotnet watch, artisan, flutter)')
  .option('--lite', 'Run lightweight server without heavy watchers')
  .action(async () => {
    await devCommand();
  });

// 3. State & Memory
program
  .command('link')
  .description('Auto-detect and wire a project codebase to an Obsidian Vault or portable memory bank')
  .argument('[targetPath]', 'Path to the project folder to wire (optional)')
  .option('-b, --browse', 'Browse for project folder with native Windows GUI dialog')
  .option('-v, --vault <vaultName>', 'Target Obsidian Vault name')
  .option('-s, --showcase', 'Mark project as showcase for portfolio')
  .option('-f, --force', 'Force overwrite of existing notes')
  .option('--portable', 'Use portable .vibe/memory/ copy-sync directory instead of junctions')
  .option('--no-obsidian', 'Output standard Markdown links and Mermaid diagrams')
  .action(async (targetPath, options) => {
    await linkCommand(targetPath, options);
  });

const stateCmd = program
  .command('state')
  .description('Unified State & Memory Controller (save, restore, checkpoint, rewind)')
  .argument('[action]', 'save | restore | list')
  .argument('[arg]', 'Checkpoint label or ID')
  .option('-l, --lesson <msg>', 'Log lesson note into Memory Bank')
  .option('-r, --rewind', 'Discard uncommitted AI edits')
  .option('-h, --hard', 'Force discard all uncommitted changes without prompt')
  .action(async (action, arg, options) => {
    await stateCommand(action, arg, options);
  });

stateCmd
  .command('save')
  .description('Save workspace state checkpoint or lesson note')
  .argument('[label...]', 'Checkpoint label')
  .option('-l, --lesson <msg>', 'Record lesson note to Lessons-and-Gotchas.md')
  .action(async (labelParts, options) => {
    const label = labelParts && labelParts.length > 0 ? labelParts.join(' ') : undefined;
    await stateSaveCommand(label, options);
  });

stateCmd
  .command('restore')
  .description('Restore previous checkpoint or rewind changes')
  .argument('[id]', 'Checkpoint ID to restore')
  .option('-r, --rewind', 'Discard uncommitted changes')
  .option('-h, --hard', 'Force discard uncommitted changes')
  .action(async (id, options) => {
    await stateRestoreCommand(id, options);
  });

program
  .command('map')
  .description('Extract codebase topology, AST exports, module dependencies, and API routes')
  .argument('[targetDir]', 'Target project directory to analyze (defaults to current dir)')
  .action(async (targetDir) => {
    await mapCommand(targetDir);
  });

// 4. Student & Learning
program
  .command('explain')
  .description('Summarize uncommitted AI workspace changes and detect security risks or gotchas')
  .option('-c, --copy', 'Copy Markdown summary directly to clipboard')
  .option('-s, --save', 'Save explanation note into .vault/Explanations/')
  .option('-j, --json', 'Output structured JSON explanation')
  .option('--last-commit', 'Analyze the last git commit (HEAD~1..HEAD)')
  .option('--quiz', 'Generate 3 professor viva oral-defense questions')
  .action(async (options) => {
    await explainCommand(options);
  });

program
  .command('learn')
  .description('Oral-defense learning mode: digest last commit & generate 3 viva exam defense questions')
  .action(async () => {
    await learnCommand();
  });

program
  .command('rubric')
  .description('Score codebase against academic software engineering rubric criteria')
  .action(async () => {
    await rubricCommand();
  });

program
  .command('wrapup')
  .description('Archive completed tasks from _Context.md to Memory Bank and prune to <= 60 lines')
  .option('--academic', 'Include academic study notes in session wrapup')
  .action(async () => {
    await wrapupCommand();
  });

program
  .command('ship')
  .description('Zero-credit-card student launch preflight (Vercel, Cloudflare, Render, Supabase)')
  .argument('[targetDir]', 'Project directory to audit for launch (defaults to current dir)')
  .option('--free', 'Perform zero-credit-card student deployment preflight', true)
  .action(async (targetDir, options) => {
    await shipCommand(targetDir, options);
  });

program
  .command('doctor')
  .description('Hardware-aware VRAM diagnostic and student setup doctor')
  .option('--student', 'Check hardware RAM/VRAM and recommend exact Ollama quantizations', true)
  .action(async (options) => {
    await doctorCommand(options);
  });

// 5. Diagnostics & Stack Utilities
program
  .command('check')
  .description('Run the auto-detected verification suite for the current project')
  .action(async () => {
    await checkCommand();
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
  .command('db')
  .description('Parse database schema (Prisma/SQL), generate ER diagram, and write table dictionary')
  .argument('[targetDir]', 'Target project directory (defaults to current dir)')
  .action(async (targetDir) => {
    await dbCommand(targetDir);
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
  .command('triage')
  .description('Run verification suite, capture stack traces, and synthesize surgical fix prompts')
  .argument('[customCommand]', 'Optional verification command to execute')
  .action(async (customCommand) => {
    await triageCommand(customCommand);
  });

program
  .command('tunnel')
  .description('Instant zero-config Cloudflare public bridge, terminal QR code, and Stripe webhook relay')
  .argument('[port]', 'Local port to forward (auto-detects if omitted)')
  .option('-p, --port <port>', 'Local port to forward')
  .option('-s, --stripe', 'Display Stripe webhook forwarding instructions')
  .option('--no-qr', 'Disable terminal QR code display')
  .action(async (port, options) => {
    await tunnelCommand(port, options);
  });

program
  .command('guide')
  .description('View in-terminal usage guides and workflow documentation')
  .argument('[topic]', 'Topic: quickstart | daily | architecture | topology | launch | skills | all')
  .action(async (topic) => {
    await guideCommand(topic);
  });

program
  .command('rules')
  .description('Universal Cross-Agent Rules & Prompt-Cache Architect (Cursor, Claude Code, Windsurf, Copilot)')
  .argument('[action]', 'Action: sync | check | clean', 'sync')
  .option('-t, --target <target>', 'Target: all | cursor | claude | windsurf | copilot | agents', 'all')
  .option('-d, --dry-run', 'Preview rule files without writing')
  .action(async (action, options) => {
    await rulesCommand(action, options);
  });

// --- Silent Backwards-Compatible Aliases (Omitted from llms.txt & help) ---
program
  .command('snap', { hidden: true })
  .description('Silent alias for vibe state save --lesson')
  .argument('[message...]', 'Note or gotcha message to record')
  .action(async (messageParts) => {
    const message = messageParts && messageParts.length > 0 ? messageParts.join(' ') : undefined;
    await snapCommand(message);
  });

program
  .command('checkpoint', { hidden: true })
  .description('Silent alias for vibe state save')
  .argument('[label...]', 'Checkpoint label')
  .option('-l, --list', 'List stored checkpoints')
  .action(async (labelParts, options) => {
    const label = labelParts && labelParts.length > 0 ? labelParts.join(' ') : undefined;
    await checkpointCommand(label, options);
  });

program
  .command('rollback', { hidden: true })
  .description('Silent alias for vibe state restore')
  .argument('[checkpointId]', 'ID of checkpoint to restore')
  .action(async (checkpointId) => {
    await rollbackCommand(checkpointId);
  });

program
  .command('rewind', { hidden: true })
  .description('Silent alias for vibe state restore --rewind')
  .option('-h, --hard', 'Force reset all modified and untracked files without prompting')
  .option('-c, --checkpoint', 'Restore the latest snapshot checkpoint')
  .option('-d, --dry-run', 'Preview changes that would be discarded without modifying files')
  .action(async (options) => {
    await rewindCommand(options);
  });

program
  .command('clarify', { hidden: true })
  .description('Silent alias for vibe spec --clarify')
  .argument('[featureName...]', 'Feature or module to clarify')
  .action(async (featureParts) => {
    const feature = featureParts && featureParts.length > 0 ? featureParts.join(' ') : undefined;
    await clarifyCommand(feature);
  });

program
  .command('prompt', { hidden: true })
  .description('Silent alias for vibe spec --prompt')
  .argument('[task...]', 'Description of feature or task')
  .action(async (taskParts) => {
    const task = taskParts && taskParts.length > 0 ? taskParts.join(' ') : undefined;
    await promptCommand(task);
  });

program
  .command('monetize', { hidden: true })
  .description('Deprecated: Scaffolds Stripe subscriptions')
  .argument('[targetDir]', 'Target project directory')
  .action(async (targetDir) => {
    console.warn(pc.yellow('Notice: vibe monetize is deprecated. Zero-budget student edition recommends vibe ship --free.'));
    await monetizeCommand(targetDir);
  });

// Supporting vault & skill subcommands
const vaultCmd = program.command('vault', { hidden: true }).description('Manage Obsidian Vaults');
vaultCmd.command('create').argument('[vaultName]').option('-p, --path <path>').option('-u, --use').action(vaultCreateCommand);
vaultCmd.command('list').action(vaultListCommand);
vaultCmd.command('switch').argument('[vaultName]').action(vaultSwitchCommand);

const skillCmd = program.command('skill', { hidden: true }).description('Manage Skills');
skillCmd.command('compile').argument('[filePath]').action(skillCompileCommand);
skillCmd.command('create').argument('[intent...]').action(async (parts, opts) => {
  const intent = parts && parts.length > 0 ? parts.join(' ') : undefined;
  await skillCreateCommand(intent, opts);
});
skillCmd.command('list').action(skillListCommand);
skillCmd.command('test').argument('[skillDir]').action(skillTestCommand);
skillCmd.command('install').argument('[skillDir]').action(skillInstallCommand);
skillCmd.command('from-api').argument('[spec]').action(skillFromApiCommand);
skillCmd.command('audit').argument('[skillDir]').action(skillAuditCommand);

program
  .command('scan', { hidden: true })
  .argument('[rootDir]')
  .action(scanCommand);

program
  .command('init', { hidden: true })
  .argument('[projectName]')
  .action(initCommand);

program
  .command('sync', { hidden: true })
  .action(syncCommand);

program
  .command('watch', { hidden: true })
  .action(watchCommand);

program
  .command('health', { hidden: true })
  .action(healthCommand);

program
  .command('canvas', { hidden: true })
  .argument('[targetDir]')
  .action(canvasCommand);

program
  .command('audit', { hidden: true })
  .argument('[targetDir]')
  .action(auditCommand);

program
  .command('showcase', { hidden: true })
  .argument('[state]')
  .action(showcaseCommand);

program.parse();
