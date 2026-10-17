import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, saveConfig, findProjectByPath } from '../config.js';
import { syncCommand } from './sync.js';

export async function showcaseCommand(state?: string): Promise<void> {
  const cwd = process.cwd();
  const contextPath = path.join(cwd, '.vault', '_Context.md');

  if (!fs.existsSync(contextPath)) {
    p.log.error('No .vault/_Context.md found in current project.');
    p.log.info('Make sure you run this command inside a linked project.');
    return;
  }

  const raw = fs.readFileSync(contextPath, 'utf-8');
  const parsed = matter(raw);
  const currentShowcase = Boolean(parsed.data.showcase);

  let targetState: boolean;
  if (state === 'on' || state === 'true' || state === 'enable') {
    targetState = true;
  } else if (state === 'off' || state === 'false' || state === 'disable') {
    targetState = false;
  } else {
    targetState = !currentShowcase;
  }

  parsed.data.showcase = targetState;
  parsed.data.updatedAt = new Date().toISOString();
  fs.writeFileSync(contextPath, matter.stringify(parsed.content, parsed.data), 'utf-8');

  // Also update config
  const config = loadConfig();
  const proj = findProjectByPath(config, cwd);
  if (proj) {
    proj.showcase = targetState;
    saveConfig(config);
  }

  p.log.success(
    `Project showcase set to: ${targetState ? pc.green(pc.bold('ON (Portfolio Active)')) : pc.dim('OFF')}`
  );

  // Trigger sync to publish/unpublish from portfolio
  await syncCommand();
}
