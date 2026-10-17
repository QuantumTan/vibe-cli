import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export async function snapCommand(message?: string): Promise<void> {
  const cwd = process.cwd();
  const vaultDir = path.join(cwd, '.vault');

  if (!fs.existsSync(vaultDir)) {
    p.log.error('No .vault directory found in current working directory.');
    p.log.info('Run `vibe link` first to wire this project to Obsidian.');
    return;
  }

  let text = message;
  if (!text) {
    const input = await p.text({
      message: 'Enter lesson, gotcha, or architectural decision to snap:',
      placeholder: 'Fixed race condition in auth token listener using mutex',
      validate: (val) => (!val?.trim() ? 'Message cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Snap canceled.');
      return;
    }
    text = (input as string).trim();
  }

  const memoryDir = path.join(vaultDir, 'Memory-Bank');
  const lessonsFile = path.join(memoryDir, 'Lessons-and-Gotchas.md');
  const contextFile = path.join(vaultDir, '_Context.md');

  fs.ensureDirSync(memoryDir);

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const entry = `\n- [${timestamp}] ${text}\n`;

  if (!fs.existsSync(lessonsFile)) {
    fs.writeFileSync(
      lessonsFile,
      `# Lessons and Gotchas\n\nDocument critical edge cases, subtle bugs, and lessons learned here.\n${entry}`,
      'utf-8'
    );
  } else {
    fs.appendFileSync(lessonsFile, entry, 'utf-8');
  }

  // Update _Context.md updatedAt
  if (fs.existsSync(contextFile)) {
    try {
      const raw = fs.readFileSync(contextFile, 'utf-8');
      const parsed = matter(raw);
      parsed.data.updatedAt = new Date().toISOString();
      fs.writeFileSync(contextFile, matter.stringify(parsed.content, parsed.data), 'utf-8');
    } catch {
      // ignore
    }
  }

  p.log.success(pc.green(`Snapped to Obsidian: "${text}"`));
  p.note(`Updated: .vault/Memory-Bank/Lessons-and-Gotchas.md`, 'Memory Preserved');
}
