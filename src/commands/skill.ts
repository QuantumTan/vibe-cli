import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { compileSkill } from '../skills/compiler.js';
import { openWindowsFilePicker } from '../gui-picker.js';
import { SkillTarget, SkillTool } from '../skills/types.js';

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

  const entry = `- **[[Skills/${skillName}/SKILL|${skillName}]]** — ${tools.length} tool(s) [${riskBadge}] • Target: \`${target}\``;

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
        { value: 'all', label: '🌐 All Targets (Antigravity SKILL.md, MCP Server, Cursor, OpenAI)' },
        { value: 'antigravity', label: '💎 Google Antigravity (SKILL.md + Guarded Standalone Runner)' },
        { value: 'mcp', label: '🔌 Anthropic Claude / MCP Server (Zero-Dependency Stdio Server)' },
        { value: 'cursor', label: '⚡ Cursor / Windsurf (.cursorrules & .windsurfrules)' },
        { value: 'openai', label: '🤖 OpenAI & Anthropic JSON Tools (Function Calling Schema)' },
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

    // Display summary of generated files
    const fileList = result.files
      .map((f) => `  • ${pc.bold(pc.white(f.relativePath))} (${pc.dim(f.description)})`)
      .join('\n');

    p.note(
      `Skill Name:   ${pc.cyan(result.skill.name)} (v${result.skill.version})\n` +
        `Tools:        ${pc.yellow(String(result.skill.tools.length))} discovered\n` +
        `Output Dir:   ${pc.dim(outDir)}\n\n` +
        `Generated Artifacts:\n${fileList}`,
      'Skill Build Summary'
    );

    p.outro(pc.green(`✔ Skill ready! Wire to Antigravity, Claude Desktop, or Cursor agents.`));
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

    p.note(
      `Name:        ${pc.cyan(result.skill.name)}\n` +
        `Risk:        ${pc.yellow(result.skill.tools[0]?.riskLevel || 'read_only')}\n` +
        `Location:    ${pc.dim(outDir)}\n` +
        `Files:       ${result.files.map((f) => f.relativePath).join(', ')}`,
      'Generated Skill Package'
    );

    p.outro(pc.green('✔ Multi-target AI agent skill generated with deterministic safety!'));
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

  const skillsFound: Array<{ name: string; dir: string; hasMcp: boolean; hasAntigravity: boolean; hasCursor: boolean }> = [];

  for (const dir of searchDirs) {
    if (await fs.pathExists(dir)) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dir, entry.name);
          const hasMcp = await fs.pathExists(path.join(skillDir, 'mcp-server.js'));
          const hasAntigravity = await fs.pathExists(path.join(skillDir, 'SKILL.md'));
          const hasCursor = await fs.pathExists(path.join(skillDir, '.cursorrules'));

          skillsFound.push({
            name: entry.name,
            dir: skillDir,
            hasMcp,
            hasAntigravity,
            hasCursor,
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
    ].filter(Boolean).join(' • ');

    return `  ⚡ ${pc.bold(pc.white(s.name))} [${targets || 'Standard'}]\n     ${pc.dim(s.dir)}`;
  }).join('\n\n');

  p.note(table, `Installed AI Agent Skills (${skillsFound.length})`);
  p.outro(pc.green('Use `vibe skill compile` to compile additional tools.'));
}
