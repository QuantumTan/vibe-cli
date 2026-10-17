import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { compileSkill } from '../skills/compiler.js';
import { openWindowsFilePicker } from '../gui-picker.js';
import { SkillTarget, SkillTool } from '../skills/types.js';
import { testSkill } from '../skills/tester.js';
import { installSkillToClients, SupportedClient } from '../skills/installer.js';
import { parseOpenAPISpec } from '../skills/openapi.js';
import { auditSkill } from '../skills/auditor.js';

export interface SkillCompileOptions {
  target?: SkillTarget;
  out?: string;
  saveVault?: boolean;
  browse?: boolean;
}

export interface SkillCreateOptions {
  name?: string;
  target?: SkillTarget;
  out?: string;
}


/**
 * Register compiled skill in Obsidian Vault Symbol Index for graph linkage.
 */
async function registerSkillInVault(
  vaultDir: string,
  skillName: string,
  target: string,
  tools: SkillTool[]
): Promise<void> {
  const indexFile = path.join(vaultDir, 'Architecture', '00-Symbol-Index.md');
  if (!(await fs.pathExists(indexFile))) return;

  const content = await fs.readFile(indexFile, 'utf8');
  const sectionHeader = '## AI Agent Skills (Multi-Target Suite)';

  const primaryTool = tools[0];
  const riskBadge =
    primaryTool?.riskLevel === 'destructive_write'
      ? '🔴 Destructive'
      : primaryTool?.riskLevel === 'privileged'
      ? '🟣 Privileged'
      : primaryTool?.riskLevel === 'idempotent_write'
      ? '🟡 Write'
      : '🟢 Read-Only';

  const entry = `- **[[Skills/${skillName}/SKILL|${skillName}]]**: ${tools.length} tool(s) [${riskBadge}] • Target: \`${target}\``;

  if (content.includes(`[[Skills/${skillName}/SKILL`)) {
    return; // Already indexed
  }

  let updated: string;
  if (content.includes(sectionHeader)) {
    updated = content.replace(sectionHeader, `${sectionHeader}\n${entry}`);
  } else {
    updated = `${content.trim()}\n\n${sectionHeader}\n${entry}\n`;
  }

  await fs.writeFile(indexFile, updated, 'utf8');
}

/**
 * vibe skill compile <file>
 */
export async function skillCompileCommand(
  sourceFileInput?: string,
  options: SkillCompileOptions = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe skill compile ')) + ' ' + pc.bold('Multi-Target Skill & Guardrail Compiler'));

  let filePath = sourceFileInput;

  if (options.browse && !filePath) {
    const picked = await openWindowsFilePicker('Select Script to Compile into AI Agent Skill');
    if (picked) {
      filePath = picked;
    }
  }

  if (!filePath) {
    const input = await p.text({
      message: 'Enter path to script file (Python, TypeScript, JS, JSON):',
      placeholder: './scripts/clean-db.py',
      validate: (val) => (!val?.trim() ? 'Path is required' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Compilation canceled.');
      return;
    }
    filePath = input.trim();
  }

  const resolvedSource = path.resolve(filePath);
  if (!(await fs.pathExists(resolvedSource))) {
    p.log.error(`File not found: ${resolvedSource}`);
    return;
  }

  // Target selection
  let target: SkillTarget = options.target || 'all';
  if (!options.target) {
    const selectedTarget = await p.select({
      message: 'Select compilation target for this AI skill:',
      options: [
        { value: 'all', label: '🌐 All Targets (Antigravity, MCP, Cursor, OpenAI, OpenCode, Hermes, Goose, Claude Code, OpenHands, Aider, Continue)' },
        { value: 'antigravity', label: '💎 Google Antigravity (SKILL.md + Guarded Standalone Runner)' },
        { value: 'mcp', label: '🔌 Anthropic Claude / MCP Server (Zero-Dependency Stdio Server)' },
        { value: 'cursor', label: '⚡ Cursor / Windsurf (.cursorrules & .windsurfrules)' },
        { value: 'openai', label: '🤖 OpenAI & Anthropic JSON Tools (Function Calling Schema)' },
        { value: 'opencode', label: '⚡ OpenCode Harness (opencode.json MCP & Permission Policy)' },
        { value: 'hermes', label: '🏺 Nous Hermes Agent (~/.hermes/skills & <tools> Function Calling)' },
        { value: 'goose', label: '🪿 Goose (Block) (goose-extension.yaml & .goosehints)' },
        { value: 'claudecode', label: '📟 Claude Code (.claude/mcp.json & CLAUDE.md)' },
        { value: 'openhands', label: '🙌 OpenHands (.openhands/microagents/)' },
        { value: 'aider', label: '🤝 Aider (.aider.conf.yml & .aiderignore)' },
        { value: 'continue', label: '⏩ Continue.dev (continue-config.json MCP Server)' },
      ],
    });

    if (p.isCancel(selectedTarget)) {
      p.cancel('Compilation canceled.');
      return;
    }
    target = selectedTarget as SkillTarget;
  }

  // Determine output directory
  const cwd = process.cwd();
  const vaultDir = path.join(cwd, '.vault');
  const hasVault = await fs.pathExists(vaultDir);

  let outDir = options.out;
  if (!outDir) {
    if (hasVault) {
      const baseName = path.basename(resolvedSource, path.extname(resolvedSource)).toLowerCase();
      outDir = path.join(vaultDir, 'Skills', baseName);
    } else {
      const baseName = path.basename(resolvedSource, path.extname(resolvedSource)).toLowerCase();
      outDir = path.join(cwd, 'skills', baseName);
    }
  }

  const s = p.spinner();
  s.start(`Compiling ${pc.cyan(path.basename(resolvedSource))} to target [${target}]...`);

  try {
    const content = await fs.readFile(resolvedSource, 'utf8');
    const result = await compileSkill(content, {
      target,
      sourcePath: resolvedSource,
      outDir,
      writeFiles: true,
    });

    s.stop(`Compiled skill ${pc.bold(pc.green(result.skill.name))} successfully!`);

    // Register in Obsidian Vault if present
    if (hasVault) {
      await registerSkillInVault(vaultDir, result.skill.name, target, result.skill.tools);
    }

    // Display Warnings & Security Guardrails
    if (result.warnings.length > 0) {
      for (const w of result.warnings) {
        p.log.warn(pc.yellow(w));
      }
    }

    const firstTool = result.skill.tools[0]?.name || result.skill.name;
    const targetSummary = 'Antigravity, MCP, OpenCode, Hermes, Claude Code, Goose, OpenHands, Cursor';

    p.note(
      `Skill:    ${pc.cyan(result.skill.name)} (v${result.skill.version})\n` +
        `Tools:    ${pc.yellow(String(result.skill.tools.length))} discovered\n` +
        `Risk:     ${pc.yellow(result.skill.tools[0]?.riskLevel || 'read_only')}\n` +
        `Location: ${pc.dim(outDir)}\n` +
        `Targets:  ${pc.white(targetSummary)}\n\n` +
        pc.bold('How to use this skill now:\n') +
        `  1. Route task directly:   ${pc.green(`vibe route "${firstTool}"`)}\n` +
        `  2. Install into AI agent: ${pc.green(`vibe skill install ${outDir}`)}\n` +
        `  3. Run security tests:    ${pc.green(`vibe skill test ${outDir}`)}`,
      'Skill Compiled'
    );

    p.outro(pc.green('Skill ready to use.'));
  } catch (err: any) {
    s.stop(pc.red('Compilation failed.'));
    p.log.error(err.message);
  }
}

/**
 * vibe skill create [intent]
 */
export async function skillCreateCommand(
  intentInput?: string,
  options: SkillCreateOptions = {}
): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(' vibe skill create ')) + ' ' + pc.bold('Synthesize AI Skill from Natural Intent'));

  let intent = intentInput;
  if (!intent) {
    const input = await p.text({
      message: 'Describe the skill / tool you want to synthesize:',
      placeholder: 'Clean old PostgreSQL logs older than retention_days with db_url',
      validate: (val) => (!val?.trim() ? 'Description cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Skill creation canceled.');
      return;
    }
    intent = input.trim();
  }

  const s = p.spinner();
  s.start('Synthesizing Skill IR & deterministic guardrails...');

  const cwd = process.cwd();
  const vaultDir = path.join(cwd, '.vault');
  const hasVault = await fs.pathExists(vaultDir);

  try {
    const result = await compileSkill(intent, {
      target: options.target || 'all',
      writeFiles: false,
    });

    s.stop(`Synthesized ${pc.green(result.skill.name)} with ${result.skill.tools.length} tool(s)!`);

    const outDir = options.out || (hasVault ? path.join(vaultDir, 'Skills', result.skill.name) : path.join(cwd, 'skills', result.skill.name));

    // Re-compile and write
    await compileSkill(intent, {
      target: options.target || 'all',
      outDir,
      writeFiles: true,
    });

    if (hasVault) {
      await registerSkillInVault(vaultDir, result.skill.name, options.target || 'all', result.skill.tools);
    }

    const firstTool = result.skill.tools[0]?.name || result.skill.name;
    const targetSummary = 'Antigravity, MCP, OpenCode, Hermes, Claude Code, Goose, OpenHands, Cursor';

    p.note(
      `Skill:    ${pc.cyan(result.skill.name)}\n` +
        `Risk:     ${pc.yellow(result.skill.tools[0]?.riskLevel || 'read_only')}\n` +
        `Location: ${pc.dim(outDir)}\n` +
        `Targets:  ${pc.white(targetSummary)}\n\n` +
        pc.bold('How to use this skill now:\n') +
        `  1. Route task directly:   ${pc.green(`vibe route "${firstTool}"`)}\n` +
        `  2. Install into AI agent: ${pc.green(`vibe skill install ${outDir}`)}\n` +
        `  3. Run security tests:    ${pc.green(`vibe skill test ${outDir}`)}`,
      'Skill Created'
    );

    p.outro(pc.green('Skill ready to use.'));
  } catch (err: any) {
    s.stop(pc.red('Synthesis failed.'));
    p.log.error(err.message);
  }
}

/**
 * vibe skill list
 */
export async function skillListCommand(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe skill list ')) + ' ' + pc.bold('Discovered AI Agent Skills'));

  const cwd = process.cwd();
  const searchDirs = [
    path.join(cwd, '.vault', 'Skills'),
    path.join(cwd, 'skills'),
  ];

  const skillsFound: Array<{
    name: string;
    dir: string;
    hasMcp: boolean;
    hasAntigravity: boolean;
    hasCursor: boolean;
    hasOpenCode: boolean;
    hasHermes: boolean;
    hasGoose: boolean;
    hasClaudeCode: boolean;
    hasOpenHands: boolean;
  }> = [];

  for (const dir of searchDirs) {
    if (await fs.pathExists(dir)) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dir, entry.name);
          const hasMcp = await fs.pathExists(path.join(skillDir, 'mcp-server.js'));
          const hasAntigravity = await fs.pathExists(path.join(skillDir, 'SKILL.md'));
          const hasCursor = await fs.pathExists(path.join(skillDir, '.cursorrules'));
          const hasOpenCode = await fs.pathExists(path.join(skillDir, 'opencode.json'));
          const hasHermes = await fs.pathExists(path.join(skillDir, 'hermes-tools.json'));
          const hasGoose = await fs.pathExists(path.join(skillDir, 'goose-extension.yaml'));
          const hasClaudeCode = await fs.pathExists(path.join(skillDir, 'CLAUDE.md'));
          const hasOpenHands = await fs.pathExists(path.join(skillDir, '.openhands'));

          skillsFound.push({
            name: entry.name,
            dir: skillDir,
            hasMcp,
            hasAntigravity,
            hasCursor,
            hasOpenCode,
            hasHermes,
            hasGoose,
            hasClaudeCode,
            hasOpenHands,
          });
        }
      }
    }
  }

  if (skillsFound.length === 0) {
    p.log.info('No compiled skills found in .vault/Skills/ or ./skills/.');
    p.log.info('Create one using `vibe skill create` or `vibe skill compile <script>`.');
    p.outro('0 skills installed.');
    return;
  }

  const table = skillsFound.map((s) => {
    const targets = [
      s.hasAntigravity ? pc.green('Antigravity') : '',
      s.hasMcp ? pc.cyan('MCP') : '',
      s.hasCursor ? pc.magenta('Cursor') : '',
      s.hasOpenCode ? pc.blue('OpenCode') : '',
      s.hasHermes ? pc.yellow('Hermes') : '',
      s.hasGoose ? pc.cyan('Goose') : '',
      s.hasClaudeCode ? pc.magenta('ClaudeCode') : '',
      s.hasOpenHands ? pc.green('OpenHands') : '',
    ].filter(Boolean).join(' • ');

    return `  ⚡ ${pc.bold(pc.white(s.name))} [${targets || 'Standard'}]\n     ${pc.dim(s.dir)}`;
  }).join('\n\n');

  p.note(table, `Installed AI Agent Skills (${skillsFound.length})`);
  p.outro(pc.green('Use `vibe skill compile` to compile additional tools.'));
}

/**
 * vibe skill test <skillDir>
 */
export async function skillTestCommand(skillDirInput?: string): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe skill test ')) + ' ' + pc.bold('Skill Sandbox & Guardrail Verification Suite'));

  let targetDir = skillDirInput;

  if (!targetDir) {
    const cwd = process.cwd();
    const searchDirs = [path.join(cwd, '.vault', 'Skills'), path.join(cwd, 'skills')];
    const available: Array<{ label: string; value: string }> = [];

    for (const dir of searchDirs) {
      if (await fs.pathExists(dir)) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            available.push({ label: e.name, value: path.join(dir, e.name) });
          }
        }
      }
    }

    if (available.length > 0) {
      const selected = await p.select({
        message: 'Select skill to test in sandbox:',
        options: available,
      });
      if (p.isCancel(selected)) return;
      targetDir = selected as string;
    } else {
      const text = await p.text({
        message: 'Enter path to skill directory:',
        placeholder: './skills/my-skill',
        validate: (val) => (!val?.trim() ? 'Path is required' : undefined),
      });
      if (p.isCancel(text)) return;
      targetDir = text.trim();
    }
  }

  const s = p.spinner();
  s.start(`Executing attack simulation and safety sandbox on ${path.basename(targetDir)}...`);

  try {
    const report = await testSkill(targetDir);
    s.stop(`Executed ${report.totalTests} sandbox safety assertions.`);

    const rows = report.cases
      .map((c) => {
        const badge = c.passed ? pc.green('✔ PASSED') : pc.red('✖ FAILED');
        return `${badge} ${pc.bold(c.name)}\n   ${pc.dim(c.message || '')}`;
      })
      .join('\n\n');

    const statusBanner = report.success
      ? pc.bgGreen(pc.black(' STATUS: 100% GUARDRAIL SECURED (PASSED) '))
      : pc.bgRed(pc.white(' STATUS: VULNERABILITY DETECTED (FAILED) '));

    p.note(
      `${statusBanner}\n\n` +
        `Skill:       ${pc.cyan(report.skillName)}\n` +
        `Runner:      ${pc.dim(report.runnerPath)}\n` +
        `Pass Rate:   ${pc.bold(pc.green(String(report.passedTests)))} / ${report.totalTests} tests passed\n\n` +
        `Test Suite Results:\n${rows}`,
      'Skill Sandbox Verification Report'
    );

    if (report.success) {
      p.outro(pc.green('✔ Skill verified safe for autonomous AI agent execution!'));
    } else {
      p.outro(pc.red('✖ Resolve vulnerabilities before exposing skill to autonomous agents.'));
    }
  } catch (err: any) {
    s.stop(pc.red('Test suite execution failed.'));
    p.log.error(err.message);
  }
}

/**
 * vibe skill install <skillDir>
 */
export async function skillInstallCommand(
  skillDirInput?: string,
  options: { all?: boolean; client?: string } = {}
): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(' vibe skill install ')) + ' ' + pc.bold('1-Click Client Wire-Up Engine'));

  let targetDir = skillDirInput;

  if (!targetDir) {
    const cwd = process.cwd();
    const searchDirs = [path.join(cwd, '.vault', 'Skills'), path.join(cwd, 'skills')];
    const available: Array<{ label: string; value: string }> = [];

    for (const dir of searchDirs) {
      if (await fs.pathExists(dir)) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            available.push({ label: e.name, value: path.join(dir, e.name) });
          }
        }
      }
    }

    if (available.length > 0) {
      const selected = await p.select({
        message: 'Select skill to install into AI client:',
        options: available,
      });
      if (p.isCancel(selected)) return;
      targetDir = selected as string;
    } else {
      const text = await p.text({
        message: 'Enter path to skill directory:',
        placeholder: './skills/my-skill',
        validate: (val) => (!val?.trim() ? 'Path is required' : undefined),
      });
      if (p.isCancel(text)) return;
      targetDir = text.trim();
    }
  }

  let selectedClients: SupportedClient[] = [
    'claude',
    'antigravity',
    'cursor',
    'opencode',
    'hermes',
    'goose',
    'claudecode',
    'openhands',
  ];

  if (!options.all) {
    const picked = await p.multiselect({
      message: 'Select which AI environments to wire this skill into (Space to toggle, Enter to confirm):',
      options: [
        { value: 'claude', label: '🔌 Claude Desktop (registers MCP stdio server in claude_desktop_config.json)' },
        { value: 'antigravity', label: '💎 Google Antigravity (copies to ~/.gemini/antigravity/skills/)' },
        { value: 'cursor', label: '⚡ Cursor / Windsurf (injects rules into project .cursorrules)' },
        { value: 'opencode', label: '⚡ OpenCode (registers MCP server in workspace opencode.json)' },
        { value: 'hermes', label: '🏺 Nous Hermes Agent (installs into ~/.hermes/skills/)' },
        { value: 'goose', label: '🪿 Goose (registers MCP extension in Goose config.yaml)' },
        { value: 'claudecode', label: '📟 Claude Code (registers MCP server in project .claude/mcp.json)' },
        { value: 'openhands', label: '🙌 OpenHands (installs microagent in workspace .openhands/microagents/)' },
      ],
      initialValues: ['claude', 'antigravity', 'cursor', 'opencode', 'hermes', 'goose', 'claudecode', 'openhands'],
    });

    if (p.isCancel(picked)) return;
    selectedClients = picked as SupportedClient[];
  }

  const s = p.spinner();
  s.start(`Installing ${path.basename(targetDir)} into selected AI environments...`);

  try {
    const results = await installSkillToClients(targetDir, selectedClients);
    s.stop('Client installation complete!');

    const summary = results
      .map((r) => {
        const badge =
          r.status === 'installed' || r.status === 'updated'
            ? pc.green(`✔ ${r.status.toUpperCase()}`)
            : r.status === 'skipped'
            ? pc.yellow('○ SKIPPED')
            : pc.red('✖ FAILED');
        return `  ${badge} ${pc.bold(r.client.toUpperCase())}: ${r.message}\n     ${pc.dim(r.path || '')}`;
      })
      .join('\n\n');

    p.note(summary, 'Client Installation Summary');
    p.outro(pc.green('✔ Skill is now immediately live in your AI client tools!'));
  } catch (err: any) {
    s.stop(pc.red('Installation failed.'));
    p.log.error(err.message);
  }
}

/**
 * vibe skill from-api <specPathOrUrl>
 */
export async function skillFromApiCommand(
  specInput?: string,
  options: { target?: SkillTarget; out?: string; browse?: boolean } = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe skill from-api ')) + ' ' + pc.bold('OpenAPI / REST to Guarded Skill Compiler'));

  let specPath = specInput;

  if (options.browse && !specPath) {
    const picked = await openWindowsFilePicker('Select OpenAPI / Swagger JSON Specification', 'JSON Files (*.json)|*.json|All Files (*.*)|*.*');
    if (picked) specPath = picked;
  }

  if (!specPath) {
    const input = await p.text({
      message: 'Enter local path or URL to OpenAPI / Swagger JSON specification:',
      placeholder: 'https://petstore.swagger.io/v2/swagger.json or ./swagger.json',
      validate: (val) => (!val?.trim() ? 'Spec path or URL is required' : undefined),
    });

    if (p.isCancel(input)) return;
    specPath = input.trim();
  }

  const s = p.spinner();
  s.start(`Ingesting OpenAPI spec and generating tool definitions...`);

  try {
    const skillIR = await parseOpenAPISpec(specPath);
    s.stop(`Discovered ${pc.bold(pc.green(String(skillIR.tools.length)))} API endpoint tools for '${skillIR.name}'!`);

    const target: SkillTarget = options.target || 'all';
    const cwd = process.cwd();
    const vaultDir = path.join(cwd, '.vault');
    const hasVault = await fs.pathExists(vaultDir);

    const outDir =
      options.out ||
      (hasVault
        ? path.join(vaultDir, 'Skills', skillIR.name)
        : path.join(cwd, 'skills', skillIR.name));

    s.start(`Compiling multi-target outputs with deterministic safety shields...`);
    const compiled = await compileSkill(JSON.stringify(skillIR), {
      target,
      outDir,
      writeFiles: true,
    });
    s.stop(`Compiled ${pc.green(skillIR.name)} with all guardrails injected!`);

    if (hasVault) {
      await registerSkillInVault(vaultDir, skillIR.name, target, skillIR.tools);
    }

    p.note(
      `API Name:     ${pc.cyan(skillIR.name)} (v${skillIR.version})\n` +
        `Endpoints:    ${pc.yellow(String(skillIR.tools.length))} tools generated\n` +
        `Output Dir:   ${pc.dim(outDir)}\n` +
        `Targets:      ${target}\n` +
        `Artifacts:    ${compiled.files.map((f) => f.relativePath).join(', ')}`,
      'REST API Skill Build Summary'
    );

    p.outro(pc.green(`✔ REST API successfully converted into guarded AI agent tools!`));
  } catch (err: any) {
    s.stop(pc.red('API ingestion failed.'));
    p.log.error(err.message);
  }
}

/**
 * vibe skill audit [skillInput]
 */
export async function skillAuditCommand(skillInput?: string): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(' vibe skill audit ')) + ' ' + pc.bold('Static Security & Guardrail Quality Auditor'));

  let target = skillInput;

  if (!target) {
    const cwd = process.cwd();
    const searchDirs = [path.join(cwd, '.vault', 'Skills'), path.join(cwd, 'skills')];
    const available: Array<{ label: string; value: string }> = [];

    for (const dir of searchDirs) {
      if (await fs.pathExists(dir)) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            available.push({ label: e.name, value: path.join(dir, e.name) });
          }
        }
      }
    }

    if (available.length > 0) {
      const selected = await p.select({
        message: 'Select skill to audit:',
        options: available,
      });
      if (p.isCancel(selected)) return;
      target = selected as string;
    } else {
      const text = await p.text({
        message: 'Enter path to skill folder or script file:',
        placeholder: './skills/my-skill',
        validate: (val) => (!val?.trim() ? 'Path is required' : undefined),
      });
      if (p.isCancel(text)) return;
      target = text.trim();
    }
  }

  const s = p.spinner();
  s.start(`Auditing security, parameter schemas, and guardrail posture...`);

  try {
    const report = await auditSkill(target);
    s.stop(`Audit complete! Grade: ${pc.bold(report.grade)} (${report.score}/100)`);

    let gradePill = pc.bgGreen(pc.black(` GRADE: ${report.grade} `));
    if (report.grade === 'B') gradePill = pc.bgCyan(pc.black(` GRADE: ${report.grade} `));
    if (report.grade === 'C') gradePill = pc.bgYellow(pc.black(` GRADE: ${report.grade} `));
    if (report.grade === 'F') gradePill = pc.bgRed(pc.white(` GRADE: ${report.grade} `));

    const findingsText =
      report.findings.length === 0
        ? pc.green('✔ Zero vulnerabilities or schema flaws detected! Ready for production.')
        : report.findings
            .map((f) => {
              const badge =
                f.level === 'critical'
                  ? pc.red('🔴 CRITICAL')
                  : f.level === 'warning'
                  ? pc.yellow('🟡 WARNING')
                  : pc.cyan('🔵 INFO');
              return `${badge} [${f.category.toUpperCase()}] ${f.message}\n   Recommendation: ${pc.dim(f.recommendation)}`;
            })
            .join('\n\n');

    p.note(
      `${gradePill}  Score: ${report.score}/100 • Tools: ${report.toolsCount}\n\n` +
        `Audit Findings:\n${findingsText}`,
      'Skill Security & Schema Quality Report'
    );

    p.outro(pc.green('✔ Audit assessment finished.'));
  } catch (err: any) {
    s.stop(pc.red('Audit failed.'));
    p.log.error(err.message);
  }
}

