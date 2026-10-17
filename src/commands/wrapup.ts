import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export async function wrapupCommand(): Promise<void> {
  const cwd = process.cwd();
  const contextPath = path.join(cwd, '.vault', '_Context.md');
  const archivePath = path.join(cwd, '.vault', 'Memory-Bank', 'Archive.md');

  if (!fs.existsSync(contextPath)) {
    p.log.error('No .vault/_Context.md found in current project.');
    p.log.info('Make sure you are inside a project linked with `vibe link`.');
    return;
  }

  p.intro(pc.bgBlue(pc.black(' vibe wrapup ')) + ' ' + pc.bold('Archive Completed Tasks & Trim Context'));

  const raw = fs.readFileSync(contextPath, 'utf-8');
  const parsed = matter(raw);
  const body = parsed.content;

  const lines = body.split(/\r?\n/);
  const remainingLines: string[] = [];
  const completedTasks: string[] = [];

  for (const line of lines) {
    if (/^\s*-\s*\[x\]/i.test(line)) {
      completedTasks.push(line.trim());
    } else {
      remainingLines.push(line);
    }
  }

  if (completedTasks.length > 0) {
    fs.ensureDirSync(path.dirname(archivePath));
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const archiveHeader = `\n### Completed Tasks (${timestamp})\n`;
    const archiveContent = archiveHeader + completedTasks.map((t) => t.replace(/\[x\]/i, '[-]')).join('\n') + '\n';

    if (!fs.existsSync(archivePath)) {
      fs.writeFileSync(
        archivePath,
        `# Task Archive\n\nCompleted tasks from _Context.md are archived here.\n${archiveContent}`,
        'utf-8'
      );
    } else {
      fs.appendFileSync(archivePath, archiveContent, 'utf-8');
    }
  }

  // Update frontmatter and write back remaining lines
  parsed.data.updatedAt = new Date().toISOString();
  const newBody = remainingLines.join('\n').trim();
  let updatedContent = matter.stringify(newBody, parsed.data);

  // Check line count limit of <= 60 lines
  const totalLines = updatedContent.split(/\r?\n/).length;
  if (totalLines > 60) {
    p.log.warn(`_Context.md has ${totalLines} lines (exceeds recommended 60 line limit). Consider trimming architectural decisions.`);
  }

  fs.writeFileSync(contextPath, updatedContent, 'utf-8');

  p.log.success(
    `Archived ${pc.bold(pc.green(String(completedTasks.length)))} completed task(s) to Memory-Bank/Archive.md.`
  );
  p.note(`Lines in _Context.md: ${totalLines} / 60 max\nStatus: Clean & Focused`, 'Context Pruned');
  p.outro(pc.green('Context window optimized for AI agents!'));
}
