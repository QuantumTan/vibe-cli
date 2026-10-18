import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'fs-extra';
import os from 'node:os';
import {
  createSafeLink,
  syncPortableMemory,
  formatLink,
} from '../src/utils/fs-link.js';
import { generateOralDefenseQuiz } from '../src/commands/explain.js';

describe('Cross-Platform Linker & Oral-Defense Learning Mode', () => {
  let tmpDir: string;
  let targetDir: string;
  let linkDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-link-test-'));
    targetDir = path.join(tmpDir, 'source-vault');
    linkDir = path.join(tmpDir, 'project-root', '.vault');
    await fs.ensureDir(targetDir);
    await fs.writeFile(path.join(targetDir, '_Context.md'), '# Context Note\n', 'utf8');
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('creates safe link (junction on Windows / symlink on POSIX) or fallback', () => {
    const result = createSafeLink(targetDir, linkDir);
    expect(result.success).toBe(true);
    expect(['junction', 'symlink', 'copy_sync']).toContain(result.type);
    expect(fs.existsSync(linkDir)).toBe(true);
  });

  it('uses portable copy-sync when --portable flag is explicitly enabled', () => {
    const portableLink = path.join(tmpDir, 'portable-vault');
    const result = createSafeLink(targetDir, portableLink, { portable: true });

    expect(result.success).toBe(true);
    expect(result.type).toBe('copy_sync');
    expect(fs.existsSync(path.join(portableLink, '_Context.md'))).toBe(true);
  });

  it('synchronizes modified markdown files based on mtime', async () => {
    const src = path.join(tmpDir, 'src-notes');
    const dst = path.join(tmpDir, 'dst-notes');
    await fs.ensureDir(src);
    await fs.ensureDir(dst);

    await fs.writeFile(path.join(src, 'Lesson.md'), 'Lesson 1', 'utf8');
    const synced1 = syncPortableMemory(src, dst);
    expect(synced1).toBe(1);
    expect(await fs.readFile(path.join(dst, 'Lesson.md'), 'utf8')).toBe('Lesson 1');

    // Wait a brief moment to update mtime
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(path.join(src, 'Lesson.md'), 'Lesson 1 Updated', 'utf8');

    const synced2 = syncPortableMemory(src, dst);
    expect(synced2).toBe(1);
    expect(await fs.readFile(path.join(dst, 'Lesson.md'), 'utf8')).toBe('Lesson 1 Updated');
  });

  it('formats standard Markdown links when noObsidian is true and wikilinks otherwise', () => {
    const standardLink = formatLink('Architecture', 'Specs/Architecture.md', true);
    expect(standardLink).toBe('[Architecture](./Specs/Architecture.md)');

    const wikiLink = formatLink('Architecture', 'Specs/Architecture.md', false);
    expect(wikiLink).toBe('[[Specs/Architecture|Architecture]]');
  });

  it('generates 3 professor viva oral-defense questions with <details> answers', () => {
    const diff = `+ export function calculateDiscount(price: number): number { return price * 0.9; }`;
    const quiz = generateOralDefenseQuiz(diff, 'a1b2c3d');

    expect(quiz.questions.length).toBe(3);
    expect(quiz.markdown).toContain('# Oral-Defense & Learning Note (a1b2c3d)');
    expect(quiz.markdown).toContain('<details>');
    expect(quiz.markdown).toContain('<summary>Answer Key (Click to expand)</summary>');
    expect(quiz.markdown).toContain('Question 1:');
    expect(quiz.markdown).toContain('Question 2:');
    expect(quiz.markdown).toContain('Question 3:');
  });
});
