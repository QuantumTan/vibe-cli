import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export interface RulesOptions {
  dryRun?: boolean;
  force?: boolean;
  target?: 'all' | 'cursor' | 'claude' | 'windsurf' | 'copilot' | 'agents';
}

export interface RuleFileDef {
  target: 'cursor' | 'claude' | 'windsurf' | 'copilot' | 'agents';
  targetLabel: string;
  filePath: string;
  content: string;
  description: string;
}

/**
 * Extracts active tasks and objectives from _Context.md
 */
export function parseContextData(contextPath: string): {
  title: string;
  stack: string[];
  category: string;
  summary: string;
  objective: string;
  activeTasks: string[];
  rawContent: string;
  updatedAt: string;
} {
  if (!fs.existsSync(contextPath)) {
    return {
      title: 'Project',
      stack: [],
      category: 'Software Project',
      summary: '',
      objective: '',
      activeTasks: [],
      rawContent: '',
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = fs.readFileSync(contextPath, 'utf-8');
    const parsed = matter(raw);
    const data = parsed.data || {};

    const objMatch = parsed.content.match(/##\s+Current Objective\s*\n+([\s\S]*?)(?=(?:##|$))/i);
    const objective = objMatch ? objMatch[1].trim() : '';

    const tasksMatch = parsed.content.match(/##\s+Active Tasks[^\n]*\n+([\s\S]*?)(?=(?:##|$))/i);
    const tasksRaw = tasksMatch ? tasksMatch[1].trim() : '';
    const activeTasks = tasksRaw
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.startsWith('-'));

    return {
      title: data.title || path.basename(process.cwd()),
      stack: Array.isArray(data.stack) ? data.stack : [],
      category: data.category || 'Software Project',
      summary: data.summary || '',
      objective,
      activeTasks,
      rawContent: parsed.content,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch {
    return {
      title: path.basename(process.cwd()),
      stack: [],
      category: 'Software Project',
      summary: '',
      objective: '',
      activeTasks: [],
      rawContent: '',
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Extracts historical lessons and tricky bugs from Lessons-and-Gotchas.md
 */
export function parseLessonsData(lessonsPath: string, maxItems = 10): string[] {
  if (!fs.existsSync(lessonsPath)) return [];
  try {
    const raw = fs.readFileSync(lessonsPath, 'utf-8');
    const lines = raw.split('\n');
    const entries: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [')) {
        entries.push(trimmed);
      }
    }

    // Return the latest lessons
    return entries.slice(-maxItems);
  } catch {
    return [];
  }
}

/**
 * Generates all rule file payloads across AI agent formats
 */
export async function generateRuleFiles(cwd = process.cwd()): Promise<RuleFileDef[]> {
  const vaultDir = path.join(cwd, '.vault');
  const contextFile = path.join(vaultDir, '_Context.md');
  const lessonsFile = path.join(vaultDir, 'Memory-Bank', 'Lessons-and-Gotchas.md');

  const contextData = parseContextData(contextFile);
  const lessons = parseLessonsData(lessonsFile, 8);
  const meta = await inspectProject(cwd);

  const stackList = meta.stack.length > 0 ? meta.stack.join(', ') : 'TypeScript, Node.js';
  const verifyCmd = meta.verifyCmd || 'npm run build';
  const devCmd = meta.devCmd || 'npm run dev';

  // Compute technology globs for Cursor MDC
  let techGlobs = '**/*.{ts,tsx,js,jsx}';
  if (meta.stack.includes('Python')) techGlobs = '**/*.{py,toml,txt}';
  if (meta.stack.includes('Flutter') || meta.stack.includes('Dart')) techGlobs = '**/*.{dart,yaml}';
  if (meta.stack.includes('C#') || meta.stack.includes('.NET')) techGlobs = '**/*.{cs,csproj,sln}';
  if (meta.stack.includes('Rust')) techGlobs = '**/*.{rs,toml}';
  if (meta.stack.includes('Go')) techGlobs = '**/*.{go,mod}';

  const lessonsBlock =
    lessons.length > 0
      ? lessons.map((l) => `  ${l}`).join('\n')
      : '  - Always verify code changes with the project verification command before declaring completion.';

  const tasksBlock =
    contextData.activeTasks.length > 0
      ? contextData.activeTasks.map((t) => `  ${t}`).join('\n')
      : '  - [ ] Complete active feature implementation\n  - [ ] Verify test suite passes';

  // 1. Cursor MDC: 00-context.mdc
  const cursorContextMdc: RuleFileDef = {
    target: 'cursor',
    targetLabel: 'Cursor (.cursor/rules/00-context.mdc)',
    filePath: path.join(cwd, '.cursor', 'rules', '00-context.mdc'),
    description: 'Universal active tasks, sliding window objectives, and context rules',
    content: `---
description: Active Project Context & Sliding Window Objectives
globs: *
alwaysApply: true
---
# Active Project Context for ${contextData.title}

> **Category**: ${meta.category} | **Stack**: ${stackList}
> **Summary**: ${contextData.summary || meta.summary}

## Current Objective
${contextData.objective || 'Implement active roadmap objectives while preserving architectural integrity.'}

## Active Tasks
${tasksBlock}

## Agent Directives
- Read \`.vault/_Context.md\` to understand current objectives before modifying files.
- Keep all modifications aligned with the active tasks.
- Verify changes with \`${verifyCmd}\` before finishing.
`,
  };

  // 2. Cursor MDC: 10-lessons.mdc
  const cursorLessonsMdc: RuleFileDef = {
    target: 'cursor',
    targetLabel: 'Cursor (.cursor/rules/10-lessons.mdc)',
    filePath: path.join(cwd, '.cursor', 'rules', '10-lessons.mdc'),
    description: 'Historical pitfalls, tricky bug resolutions, and edge cases',
    content: `---
description: Critical Bug Fixes, Pitfalls & Lessons Learned
globs: *
alwaysApply: true
---
# Lessons & Gotchas Memory Bank

Avoid repeating historical mistakes by referencing these verified resolutions:

${lessonsBlock}

## Memory Sync Protocol
- When solving a tricky edge case or bug, log a note via \`vibe snap "description"\` or append to \`.vault/Memory-Bank/Lessons-and-Gotchas.md\`.
`,
  };

  // 3. Cursor MDC: 20-stack.mdc (Scoped with globs to save tokens!)
  const cursorStackMdc: RuleFileDef = {
    target: 'cursor',
    targetLabel: 'Cursor (.cursor/rules/20-stack.mdc)',
    filePath: path.join(cwd, '.cursor', 'rules', '20-stack.mdc'),
    description: 'Glob-scoped technical guidelines, type contracts, and standards',
    content: `---
description: Codebase Architecture, Types & Verification
globs: ${techGlobs}
alwaysApply: false
---
# Technical Standards for ${meta.name}

## Toolchain & Verification
- **Verification Command**: \`${verifyCmd}\`
- **Development Server**: \`${devCmd}\`
- **Tech Stack**: ${stackList}

## Code Quality Standards
- **Strict Contracts**: Ensure all public interfaces, models, and return types are strongly typed.
- **Responsive & Accessible**: Adhere to WCAG contrast standards and responsive layout principles.
- **Defensive Error Handling**: Catch and handle potential null/undefined values; fail gracefully with descriptive error messages.
- **Verification Rule**: Always run \`${verifyCmd}\` before completing changes.
`,
  };

  // 4. Claude Code: CLAUDE.md (Optimized for prompt cache prefix!)
  const claudeMd: RuleFileDef = {
    target: 'claude',
    targetLabel: 'Claude Code (CLAUDE.md)',
    filePath: path.join(cwd, 'CLAUDE.md'),
    description: 'KV-cache optimized commands and project instructions for Claude Code',
    content: `# Claude Code Project Instructions

## Fast Verification & Commands
- **Build**: \`${verifyCmd}\`
- **Dev**: \`${devCmd}\`
- **Test**: \`npm test\`
- **Vibe CLI**: \`vibe check\` | \`vibe triage\` | \`vibe rewind\`

## Architecture & Technology
- **Project**: ${contextData.title} (${meta.category})
- **Stack**: ${stackList}

## Active Sliding Window Tasks
${tasksBlock}

## Historical Lessons & Gotchas
${lessonsBlock}

## Memory & Task Protocol
1. Consult \`.vault/_Context.md\` at task start.
2. When solving tricky bugs, record the fix in \`.vault/Memory-Bank/Lessons-and-Gotchas.md\` or run \`vibe snap\`.
3. Keep \`.vault/_Context.md\` concise (under 60 lines).
4. Run \`${verifyCmd}\` to verify all modifications before concluding.
`,
  };

  // 5. Windsurf Cascade: .windsurfrules
  const windsurfRules: RuleFileDef = {
    target: 'windsurf',
    targetLabel: 'Windsurf (.windsurfrules)',
    filePath: path.join(cwd, '.windsurfrules'),
    description: 'Cascade coding rules, verification commands, and memory guidelines',
    content: `# Windsurf Cascade Rules for ${contextData.title}

## Project Overview
- Stack: ${stackList}
- Category: ${meta.category}
- Verification: ${verifyCmd}
- Dev Command: ${devCmd}

## Active Tasks
${tasksBlock}

## Critical Gotchas
${lessonsBlock}

## Engineering Standards
- Mobile-first responsive design and accessible high-contrast UI.
- Strict type checking without phantom type casts.
- Run \`${verifyCmd}\` to ensure zero compilation or test errors.
- Sync memory bank updates to \`.vault/\` in real time.
`,
  };

  // 6. GitHub Copilot: .github/copilot-instructions.md
  const copilotInstructions: RuleFileDef = {
    target: 'copilot',
    targetLabel: 'GitHub Copilot (.github/copilot-instructions.md)',
    filePath: path.join(cwd, '.github', 'copilot-instructions.md'),
    description: 'Instructions for GitHub Copilot Workspace and Copilot Chat',
    content: `# GitHub Copilot Project Guidelines

## Stack & Verification
- Project: ${contextData.title}
- Primary Languages/Frameworks: ${stackList}
- Build / Verification Command: \`${verifyCmd}\`

## Active Tasks
${tasksBlock}

## Lessons Learned
${lessonsBlock}

## Conventions
- Preserve existing documentation, types, and comments.
- Follow modern idioms for ${stackList}.
- Test changes using \`${verifyCmd}\`.
`,
  };

  // 7. Antigravity / Universal: AGENTS.md
  const agentsMd: RuleFileDef = {
    target: 'agents',
    targetLabel: 'Universal Agents (AGENTS.md)',
    filePath: path.join(cwd, 'AGENTS.md'),
    description: 'Universal root agent contract for Antigravity, OpenCode, Hermes, and Cursor',
    content: `# Agent Guidelines & Memory Sync for ${contextData.title}

> Auto-generated by **vibe-cli**. Codebase is synchronized with Obsidian via \`.vault/\`.

## 1. Live Obsidian Context & Memory Hub
- **Project Context Hub**: \`.vault/_Context.md\` (Active tasks, sliding window objectives, architecture decisions).
- **Lessons & Gotchas**: \`.vault/Memory-Bank/Lessons-and-Gotchas.md\` (Historical learnings, tricky bugs, and pitfalls).
- **Symbol Index**: \`.vault/Architecture/00-Symbol-Index.md\` (Key components, classes, and endpoints).

## 2. Mandatory Memory Sync Rules for AI Agents
1. **At Task Start**:
   - Read \`.vault/_Context.md\` to understand current objectives before generating code.
2. **When Solving Tricky Bugs**:
   - Append an entry to \`.vault/Memory-Bank/Lessons-and-Gotchas.md\` so future prompts remember what was learned.
3. **When Adding New Components**:
   - Record the symbol in \`.vault/Architecture/00-Symbol-Index.md\`.
4. **At Task Completion**:
   - Mark completed tasks \`- [x]\` in \`.vault/_Context.md\` and update \`updatedAt\`.
   - **Strict Line Limit**: Keep \`.vault/_Context.md\` under 60 lines.
5. **Always Verify**:
   - Run verification using: \`${verifyCmd}\` (or \`vibe check\`).

## 3. Technology Stack & Commands
- **Stack**: ${stackList}
- **Dev**: \`${devCmd}\`
- **Verification**: \`${verifyCmd}\`
`,
  };

  return [
    cursorContextMdc,
    cursorLessonsMdc,
    cursorStackMdc,
    claudeMd,
    windsurfRules,
    copilotInstructions,
    agentsMd,
  ];
}

/**
 * vibe rules [action]
 * Actions: sync (default), check, clean
 */
export async function rulesCommand(
  action = 'sync',
  options: RulesOptions = {}
): Promise<void> {
  const cwd = process.cwd();
  const subAction = action.toLowerCase();

  p.intro(pc.bgCyan(pc.black(' vibe rules ')) + ' ' + pc.bold('Universal Cross-Agent Rules & Prompt-Cache Architect'));

  const ruleFiles = await generateRuleFiles(cwd);

  // Filter by target if specified
  const filtered = options.target && options.target !== 'all'
    ? ruleFiles.filter((r) => r.target === options.target)
    : ruleFiles;

  // ACTION: check
  if (subAction === 'check' || subAction === 'status') {
    const s = p.spinner();
    s.start('Auditing rule files against Obsidian memory bank...');

    const vaultDir = path.join(cwd, '.vault');
    const contextFile = path.join(vaultDir, '_Context.md');
    let contextMtime = 0;
    if (fs.existsSync(contextFile)) {
      contextMtime = fs.statSync(contextFile).mtimeMs;
    }

    const reportLines: string[] = [];
    let inSyncCount = 0;
    let missingCount = 0;
    let staleCount = 0;

    for (const r of filtered) {
      const exists = fs.existsSync(r.filePath);
      if (!exists) {
        missingCount++;
        reportLines.push(`  ${pc.red('✖ Missing')}  ${pc.bold(r.targetLabel)}`);
      } else {
        const fileMtime = fs.statSync(r.filePath).mtimeMs;
        if (contextMtime > 0 && fileMtime < contextMtime) {
          staleCount++;
          reportLines.push(`  ${pc.yellow('⚠ Stale  ')}  ${pc.bold(r.targetLabel)} ${pc.dim('(out of sync with .vault/_Context.md)')}`);
        } else {
          inSyncCount++;
          reportLines.push(`  ${pc.green('✔ Synced ')}  ${pc.bold(r.targetLabel)}`);
        }
      }
    }

    s.stop(`Audit complete: ${pc.green(`${inSyncCount} synced`)}, ${pc.yellow(`${staleCount} stale`)}, ${pc.red(`${missingCount} missing`)}`);

    p.note(
      reportLines.join('\n') +
        `\n\nRun ${pc.cyan('vibe rules sync')} to propagate memory bank into all agent configs.`,
      'Cross-Agent Rules Status'
    );
    p.outro('Rules audit finished.');
    return;
  }

  // ACTION: clean
  if (subAction === 'clean') {
    const confirm = await p.confirm({
      message: 'Are you sure you want to remove generated agent rule files (.cursor/rules/, CLAUDE.md, .windsurfrules)?',
      initialValue: false,
    });

    if (p.isCancel(confirm) || !confirm) {
      p.cancel('Clean aborted.');
      return;
    }

    let removed = 0;
    for (const r of filtered) {
      if (fs.existsSync(r.filePath)) {
        fs.removeSync(r.filePath);
        removed++;
      }
    }

    p.log.success(pc.green(`Removed ${removed} generated rule files.`));
    p.outro('Clean complete.');
    return;
  }

  // ACTION: sync (default)
  const s = p.spinner();
  s.start('Compiling Obsidian memory bank into glob-scoped agent rule files...');

  let written = 0;
  for (const r of filtered) {
    if (options.dryRun) {
      p.log.info(pc.dim(`[dry-run] Would write ${r.filePath}`));
      continue;
    }

    fs.ensureDirSync(path.dirname(r.filePath));
    fs.writeFileSync(r.filePath, r.content, 'utf-8');
    written++;
  }

  s.stop(`Successfully synchronized ${pc.bold(pc.green(String(written)))} agent rule files!`);

  const summaryList = filtered
    .map((r) => `  • ${pc.bold(pc.cyan(r.targetLabel))}\n    ${pc.dim(r.description)}`)
    .join('\n');

  p.note(
    `${summaryList}\n\n` +
      `Features active:\n` +
      `  ${pc.green('✔')} ${pc.white('Glob-scoping enabled')} (Cursor rules only load on relevant files, saving 70%+ tokens)\n` +
      `  ${pc.green('✔')} ${pc.white('KV-Cache prefix ordering')} (Static commands first for cheap cached Claude prompts)\n` +
      `  ${pc.green('✔')} ${pc.white('Memory-Bank synchronized')} (Gotchas & active tasks baked directly into rules)\n` +
      `  ${pc.green('✔')} ${pc.white('Multi-Agent ready')} (Cursor, Claude Code, Windsurf, Copilot, Antigravity)`,
    'Rules Synchronization Complete'
  );

  p.outro(pc.green('All AI coding agents now share synchronized rules and memory.'));
}
