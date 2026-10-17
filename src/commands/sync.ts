import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig, getVaultPath } from '../config.js';
import { createJunction, verifyJunction } from '../junction.js';

export interface ShowcaseProjectData {
  title: string;
  slug: string;
  vault: string;
  stack: string[];
  category: string;
  summary: string;
  repoUrl?: string;
  liveUrl?: string;
  updatedAt?: string;
  content: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function syncCommand(): Promise<void> {
  const config = loadConfig();
  p.intro(pc.bgCyan(pc.black(' vibe sync ')) + ' ' + pc.bold('Junction Healer & Portfolio Publisher'));

  const s = p.spinner();

  // 1. Junction Healer
  s.start('Verifying and repairing NTFS directory junctions...');
  let checkedCount = 0;
  let repairedCount = 0;
  let missingProjectCount = 0;

  for (const proj of config.registeredProjects) {
    if (!fs.existsSync(proj.path)) {
      missingProjectCount++;
      continue;
    }

    const vaultPath = getVaultPath(config, proj.vault);
    const expectedVaultTarget = path.join(vaultPath, '02-Projects', proj.name);
    const expectedGlobalTarget = path.join(vaultPath, '00-Global-Rules');

    const vaultLink = path.join(proj.path, '.vault');
    const globalLink = path.join(proj.path, '.vault-global');

    checkedCount++;

    if (!verifyJunction(vaultLink, expectedVaultTarget)) {
      createJunction(expectedVaultTarget, vaultLink);
      repairedCount++;
    }

    if (!verifyJunction(globalLink, expectedGlobalTarget)) {
      createJunction(expectedGlobalTarget, globalLink);
      repairedCount++;
    }
  }

  s.stop(
    `Junction Audit: Checked ${pc.bold(String(checkedCount))} projects. ` +
      (repairedCount > 0 ? pc.yellow(`Repaired ${repairedCount} junctions.`) : pc.green('All junctions healthy!'))
  );

  // 2. Cross-Vault Portfolio Publisher
  const portfolioSpinner = p.spinner();
  portfolioSpinner.start('Collecting showcase projects across all Obsidian Vaults...');

  const showcaseProjects: ShowcaseProjectData[] = [];

  for (const [vaultName, vaultPath] of Object.entries(config.vaults)) {
    const projectsDir = path.join(vaultPath, '02-Projects');
    if (!fs.existsSync(projectsDir)) continue;

    try {
      const folders = fs.readdirSync(projectsDir, { withFileTypes: true });
      for (const folder of folders) {
        if (!folder.isDirectory()) continue;

        const contextFile = path.join(projectsDir, folder.name, '_Context.md');
        if (fs.existsSync(contextFile)) {
          try {
            const raw = fs.readFileSync(contextFile, 'utf-8');
            const parsed = matter(raw);
            const data = parsed.data as Record<string, any>;

            if (data.showcase === true || data.showcase === 'true') {
              const slug = slugify(data.title || folder.name);
              showcaseProjects.push({
                title: data.title || folder.name,
                slug,
                vault: vaultName,
                stack: Array.isArray(data.stack) ? data.stack : [],
                category: data.category || 'Software Project',
                summary: data.summary || '',
                repoUrl: data.repoUrl || '',
                liveUrl: data.liveUrl || '',
                updatedAt: data.updatedAt || new Date().toISOString(),
                content: parsed.content.trim(),
              });
            }
          } catch {
            // ignore malformed notes
          }
        }
      }
    } catch {
      // ignore
    }
  }

  portfolioSpinner.message(`Exporting ${showcaseProjects.length} showcase project(s) to portfolio...`);

  let publishedToPortfolio = false;
  if (config.portfolioRepoPath && fs.existsSync(config.portfolioRepoPath)) {
    try {
      const contentDir = path.join(config.portfolioRepoPath, 'src', 'content');
      const projectsJsonPath = path.join(contentDir, 'projects.json');
      const projectsMdDir = path.join(contentDir, 'projects');

      fs.ensureDirSync(contentDir);
      fs.ensureDirSync(projectsMdDir);

      // Write projects.json (metadata summary array)
      const jsonOutput = showcaseProjects.map(({ content, ...meta }) => meta);
      fs.writeFileSync(projectsJsonPath, JSON.stringify(jsonOutput, null, 2), 'utf-8');

      // Write individual markdown collection files
      for (const item of showcaseProjects) {
        const mdFile = path.join(projectsMdDir, `${item.slug}.md`);
        const { content, ...frontmatter } = item;
        const mdOutput = matter.stringify(content, frontmatter);
        fs.writeFileSync(mdFile, mdOutput, 'utf-8');
      }

      publishedToPortfolio = true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      p.log.warn(`Could not write to portfolio repo: ${msg}`);
    }
  }

  portfolioSpinner.stop(
    `Showcase Sync: Found ${pc.bold(pc.green(String(showcaseProjects.length)))} showcase project(s).` +
      (publishedToPortfolio
        ? ` Published to ${pc.dim(config.portfolioRepoPath)}`
        : ` (Portfolio repo not configured or path does not exist)`)
  );

  p.outro(pc.green('Sync complete! Obsidian and codebases are in harmony.'));
}
