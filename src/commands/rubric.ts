import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export interface RubricCategory {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  items: Array<{ description: string; passed: boolean; tip?: string }>;
}

export interface RubricEvaluation {
  totalScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  categories: RubricCategory[];
}

/**
 * Evaluates the codebase against academic software engineering rubrics.
 */
export async function evaluateProjectRubric(cwd: string = process.cwd()): Promise<RubricEvaluation> {
  const meta = await inspectProject(cwd);

  const categories: RubricCategory[] = [];

  // 1. Architecture & Modularity (25 pts)
  const hasSrc = await fs.pathExists(path.join(cwd, 'src'));
  const hasTests = (await fs.pathExists(path.join(cwd, 'tests'))) || (await fs.pathExists(path.join(cwd, 'test')));
  const hasTsConfig = await fs.pathExists(path.join(cwd, 'tsconfig.json'));

  categories.push({
    name: 'Architecture & Modularity',
    weight: 25,
    score: (hasSrc ? 10 : 0) + (hasTests ? 10 : 0) + (hasTsConfig ? 5 : 0),
    maxScore: 25,
    items: [
      { description: 'Separated source directory (src/)', passed: hasSrc, tip: 'Keep business logic in src/' },
      { description: 'Dedicated test suite directory (tests/)', passed: hasTests, tip: 'Add unit tests in tests/' },
      { description: 'Strict compiler configuration (tsconfig.json)', passed: hasTsConfig, tip: 'Enable strict typechecking' },
    ],
  });

  // 2. Documentation & Memory Bank (25 pts)
  const hasReadme = await fs.pathExists(path.join(cwd, 'README.md'));
  const hasContext = (await fs.pathExists(path.join(cwd, '.vault', '_Context.md'))) || (await fs.pathExists(path.join(cwd, 'AGENTS.md')));
  const hasLessons = await fs.pathExists(path.join(cwd, '.vault', 'Memory-Bank', 'Lessons-and-Gotchas.md'));

  categories.push({
    name: 'Documentation & Memory Bank',
    weight: 25,
    score: (hasReadme ? 10 : 0) + (hasContext ? 10 : 0) + (hasLessons ? 5 : 0),
    maxScore: 25,
    items: [
      { description: 'Comprehensive README with setup commands', passed: hasReadme },
      { description: 'Persistent context hub (_Context.md or AGENTS.md)', passed: hasContext },
      { description: 'Lessons & Gotchas log (historical learnings)', passed: hasLessons, tip: 'Run vibe snap to record learnings' },
    ],
  });

  // 3. Security & Environment Hygiene (25 pts)
  const gitignorePath = path.join(cwd, '.gitignore');
  const hasGitignore = await fs.pathExists(gitignorePath);
  let ignoresEnv = false;
  if (hasGitignore) {
    const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    ignoresEnv = gitignoreContent.includes('.env');
  }
  const hasEnvExample = await fs.pathExists(path.join(cwd, '.env.example'));

  categories.push({
    name: 'Security & Environment Hygiene',
    weight: 25,
    score: (hasGitignore ? 10 : 0) + (ignoresEnv ? 10 : 0) + (hasEnvExample ? 5 : 0),
    maxScore: 25,
    items: [
      { description: 'Git version control ignore file (.gitignore)', passed: hasGitignore },
      { description: '.env credentials strictly excluded from git', passed: ignoresEnv, tip: 'Add .env to .gitignore' },
      { description: 'Clean environment template (.env.example)', passed: hasEnvExample, tip: 'Run vibe env --sync' },
    ],
  });

  // 4. Verification & Automated Testing (25 pts)
  const pkgPath = path.join(cwd, 'package.json');
  let hasTestScript = false;
  let hasBuildScript = false;
  if (await fs.pathExists(pkgPath)) {
    try {
      const pkg = await fs.readJson(pkgPath);
      hasTestScript = Boolean(pkg.scripts?.test);
      hasBuildScript = Boolean(pkg.scripts?.build);
    } catch {
      // ignore
    }
  }

  categories.push({
    name: 'Verification & CI/CD',
    weight: 25,
    score: (hasBuildScript ? 10 : 0) + (hasTestScript ? 15 : 0),
    maxScore: 25,
    items: [
      { description: 'Automated build script configured (npm run build)', passed: hasBuildScript },
      { description: 'Automated test suite configured (npm test)', passed: hasTestScript, tip: 'Add vitest test runner' },
    ],
  });

  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);

  let grade: RubricEvaluation['grade'] = 'F';
  if (totalScore >= 90) grade = 'A+';
  else if (totalScore >= 80) grade = 'A';
  else if (totalScore >= 70) grade = 'B';
  else if (totalScore >= 60) grade = 'C';
  else if (totalScore >= 50) grade = 'D';

  return {
    totalScore,
    grade,
    categories,
  };
}

/**
 * vibe rubric
 */
export async function rubricCommand(): Promise<void> {
  const cwd = process.cwd();
  p.intro(pc.bgCyan(pc.black(' vibe rubric ')) + ' ' + pc.bold('Academic Software Engineering Rubric Evaluator'));

  const s = p.spinner();
  s.start('Scoring project against academic grading standards...');

  const result = await evaluateProjectRubric(cwd);

  s.stop(pc.green(`Evaluation complete! Score: ${result.totalScore}/100 (Grade: ${result.grade})`));

  const sections = result.categories.map((c) => {
    const checkmarks = c.items
      .map((it) => {
        const icon = it.passed ? pc.green('✔') : pc.red('✖');
        const tip = it.tip && !it.passed ? pc.dim(` [Tip: ${it.tip}]`) : '';
        return `  ${icon} ${it.description}${tip}`;
      })
      .join('\n');
    return `${pc.bold(c.name)} (${c.score}/${c.maxScore} pts)\n${checkmarks}`;
  });

  p.note(
    `Overall Grade: ${pc.bold(result.totalScore >= 80 ? pc.green(result.grade) : pc.yellow(result.grade))} (${result.totalScore}/100)\n\n` +
      sections.join('\n\n'),
    'CS Academic Assessment Rubric'
  );

  p.outro('Address any missing rubric criteria before submitting academic portfolio or homework.');
}
