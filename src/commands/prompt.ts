import path from 'path';
import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === 'win32') {
      const ps = spawnSync('powershell.exe', ['-NoProfile', '-Command', '$input | Set-Clipboard'], {
        input: text,
        encoding: 'utf-8',
      });
      return ps.status === 0;
    }
  } catch {
    // fallback
  }
  return false;
}

export async function promptCommand(taskInput?: string): Promise<void> {
  const cwd = process.cwd();
  const contextFile = path.join(cwd, '.vault', '_Context.md');
  const lessonsFile = path.join(cwd, '.vault', 'Memory-Bank', 'Lessons-and-Gotchas.md');

  p.intro(pc.bgCyan(pc.black(' vibe prompt ')) + ' ' + pc.bold('AI Master Context & Production Prompt Generator'));

  let task = taskInput;
  if (!task) {
    const input = await p.text({
      message: 'What feature, bug fix, or module do you want your AI agent to build?',
      placeholder: 'Implement Stripe webhook to unlock Pro features and handle failed renewals',
      validate: (val) => (!val?.trim() ? 'Task description cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Prompt generation canceled.');
      return;
    }
    task = (input as string).trim();
  }

  const s = p.spinner();
  s.start('Synthesizing codebase context, lessons, and production directives...');

  const meta = await inspectProject(cwd);
  let activeContextSummary = meta.summary;
  let activeTasks = '';

  if (fs.existsSync(contextFile)) {
    try {
      const raw = fs.readFileSync(contextFile, 'utf-8');
      const parsed = matter(raw);
      if (parsed.data.summary) activeContextSummary = parsed.data.summary;
      const tasksMatch = parsed.content.match(/## Active Tasks[^\n]*\n([\s\S]*?)(?=##|$)/i);
      if (tasksMatch && tasksMatch[1]) {
        activeTasks = tasksMatch[1].trim();
      }
    } catch {
      // ignore
    }
  }

  let recentGotchas = '';
  if (fs.existsSync(lessonsFile)) {
    try {
      const content = fs.readFileSync(lessonsFile, 'utf-8');
      const lines = content
        .split(/\r?\n/)
        .filter((l) => l.trim().startsWith('- ['))
        .slice(-3);
      if (lines.length > 0) {
        recentGotchas = lines.join('\n');
      }
    } catch {
      // ignore
    }
  }

  // Construct master prompt
  const masterPrompt = `
# Task: ${task}

## 1. Project Context & Stack
- **Project**: ${meta.name} (${meta.category})
- **Tech Stack**: ${meta.stack.join(', ')}
- **Verification Command**: \`${meta.verifyCmd}\`
- **Context Summary**: ${activeContextSummary}
${activeTasks ? `\n## Current Active Tasks:\n${activeTasks}\n` : ''}
${recentGotchas ? `## Lessons & Gotchas to Respect:\n${recentGotchas}\n` : ''}
## 2. Production Quality Directives (Anti-Slop Standards)
1. **Production-Grade Completeness**: Do not leave pseudo-code or placeholder comments (e.g. "// implement later"). Write complete, resilient code.
2. **Error Boundaries & Defensive Coding**: Handle all network timeouts, null state crashes, and invalid API payloads gracefully.
3. **Accessibility & Responsive Polish**: Ensure high-contrast colors, keyboard navigation, and mobile-responsive layout.
4. **Zero Secrets in Code**: Read all private tokens, credentials, and API secrets from environment variables.
5. **Mandatory Verification**: Run \`${meta.verifyCmd}\` to ensure zero compilation or type errors before completing.
6. **Live Obsidian Memory Sync**: Update \`.vault/_Context.md\` with completed tasks and append any discovered gotchas to \`.vault/Memory-Bank/Lessons-and-Gotchas.md\`.
`.trim();

  s.stop('Master prompt generated!');

  const copied = copyToClipboard(masterPrompt);

  p.note(masterPrompt, 'Generated Master Prompt');

  if (copied) {
    p.log.success(pc.bold(pc.green('📋 Copied to Windows Clipboard!')) + ' Just press Ctrl+V into Antigravity or Cursor.');
  } else {
    p.log.info('Highlight and copy the prompt text above into your AI chat.');
  }

  p.outro(pc.green('Ready to vibe code with production accuracy!'));
}
