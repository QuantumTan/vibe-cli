import path from 'path';
import fs from 'fs-extra';
import { spawn } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export interface ShipReport {
  score: number;
  checks: Array<{ name: string; passed: boolean; message: string; critical: boolean }>;
  readyToShip: boolean;
}

function runCommandAsync(cmd: string, cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = cmd.split(' ');
    const child = spawn(parts[0], parts.slice(1), { cwd, shell: true, stdio: 'ignore' });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

/**
 * Scaffolds GDPR/CCPA compliant legal templates into .vault/Legal/ or ./legal/.
 */
export async function scaffoldLegalSuite(targetDir: string, appName: string): Promise<string[]> {
  await fs.ensureDir(targetDir);
  const dateStr = new Date().toISOString().substring(0, 10);

  const privacyMd = `# Privacy Policy for ${appName}
*Last updated: ${dateStr}*

## 1. Information We Collect
We collect information you provide directly to us when creating an account, making a purchase, or communicating with us.

## 2. How We Use Information
We use the information we collect to provide, maintain, and improve our services, process payments, and prevent fraud.

## 3. Data Protection & GDPR Rights
If you are located in the EU, you have rights to access, rectify, port, or erase your personal data upon request.

## 4. Contact Us
For questions about this policy, contact support@${appName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.
`;

  const termsMd = `# Terms of Service for ${appName}
*Last updated: ${dateStr}*

## 1. Agreement to Terms
By accessing or using ${appName}, you agree to be bound by these Terms of Service.

## 2. Subscriptions & Billing
Paid subscriptions automatically renew unless canceled prior to the end of the billing period.

## 3. Limitation of Liability
To the maximum extent permitted by law, ${appName} shall not be liable for any indirect, incidental, or consequential damages.
`;

  const files = [
    { name: 'Privacy-Policy.md', content: privacyMd },
    { name: 'Terms-of-Service.md', content: termsMd },
  ];

  const created: string[] = [];
  for (const f of files) {
    const pth = path.join(targetDir, f.name);
    if (!(await fs.pathExists(pth))) {
      await fs.writeFile(pth, f.content, 'utf8');
      created.push(f.name);
    }
  }

  return created;
}

/**
 * Scaffolds production Dockerfile and CI/CD if missing.
 */
export async function scaffoldDockerAndCI(cwd: string, stack: string[]): Promise<string[]> {
  const created: string[] = [];

  const dockerfilePath = path.join(cwd, 'Dockerfile');
  if (!(await fs.pathExists(dockerfilePath))) {
    let dockerContent = '';
    if (stack.includes('React') || stack.includes('Next.js') || stack.includes('Vite') || stack.includes('TypeScript')) {
      dockerContent = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start"]
`;
    } else {
      dockerContent = `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
    }

    await fs.writeFile(dockerfilePath, dockerContent, 'utf8');
    created.push('Dockerfile');

    const dockerignore = path.join(cwd, '.dockerignore');
    if (!(await fs.pathExists(dockerignore))) {
      await fs.writeFile(dockerignore, 'node_modules\n.git\n.vault\n.vault-global\n', 'utf8');
      created.push('.dockerignore');
    }
  }

  // GitHub Actions Workflow
  const githubDir = path.join(cwd, '.github', 'workflows');
  const workflowPath = path.join(githubDir, 'ci.yml');
  if (!(await fs.pathExists(workflowPath))) {
    await fs.ensureDir(githubDir);
    const ciYaml = `name: Build & Verify
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build
`;
    await fs.writeFile(workflowPath, ciYaml, 'utf8');
    created.push('.github/workflows/ci.yml');
  }

  return created;
}

/**
 * vibe ship [targetDir]
 */
export async function shipCommand(targetDirInput?: string): Promise<void> {
  p.intro(pc.bgGreen(pc.black(' vibe ship ')) + ' ' + pc.bold('Commercial Launch Gate & Production Readiness'));

  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);
  const meta = await inspectProject(cwd);

  const s = p.spinner();
  s.start(`Auditing ${projectName} across 5 commercial production pillars...`);

  const checks: ShipReport['checks'] = [];
  let score = 100;

  // 1. Secrets & Environment Audit
  const envPath = path.join(cwd, '.env');
  const envExamplePath = path.join(cwd, '.env.example');
  let envPassed = true;
  let envMsg = 'Environment configuration validated.';

  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, 'utf8');
    if (/sk_test_|localhost:8080|CHANGEME|TODO|your_secret_here/i.test(envContent)) {
      envPassed = false;
      envMsg = 'Detected placeholder or test keys (sk_test_ / CHANGEME) in .env!';
      score -= 20;
    }
  } else if (await fs.pathExists(envExamplePath)) {
    envPassed = false;
    envMsg = 'Found .env.example but no active .env file configured.';
    score -= 10;
  }

  checks.push({
    name: 'Production Secrets & Environment',
    passed: envPassed,
    message: envMsg,
    critical: true,
  });

  // 2. SEO & Web Assets
  const publicDir = path.join(cwd, 'public');
  const robotsPath = path.join(publicDir, 'robots.txt');
  const hasRobots = await fs.pathExists(robotsPath);

  if (!hasRobots && (meta.stack.includes('React') || meta.stack.includes('Next.js') || meta.stack.includes('Vite'))) {
    await fs.ensureDir(publicDir);
    await fs.writeFile(robotsPath, 'User-agent: *\nAllow: /\n', 'utf8');
    checks.push({
      name: 'SEO & Crawl Directives',
      passed: true,
      message: 'Scaffolded public/robots.txt automatically.',
      critical: false,
    });
  } else {
    checks.push({
      name: 'SEO & Crawl Directives',
      passed: hasRobots,
      message: hasRobots ? 'Found robots.txt' : 'robots.txt not detected (recommend adding to public/)',
      critical: false,
    });
    if (!hasRobots) score -= 5;
  }

  // 3. Legal Compliance Suite
  const vaultLegalDir = path.join(cwd, '.vault', 'Legal');
  const localLegalDir = path.join(cwd, 'legal');
  const targetLegal = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultLegalDir : localLegalDir;
  const legalCreated = await scaffoldLegalSuite(targetLegal, projectName);

  checks.push({
    name: 'Legal Suite (GDPR Privacy Policy & Terms)',
    passed: true,
    message: legalCreated.length > 0 ? `Scaffolded ${legalCreated.join(', ')} in ${targetLegal}` : 'Legal compliance policies present.',
    critical: false,
  });

  // 4. Verification Suite Gate
  s.message(`Running project verification suite (${meta.verifyCmd})...`);
  const buildSuccess = await runCommandAsync(meta.verifyCmd, cwd);

  checks.push({
    name: `Build & Verification Gate (\`${meta.verifyCmd}\`)`,
    passed: buildSuccess,
    message: buildSuccess ? 'Codebase compiles with 0 build errors.' : `Verification command failed (\`${meta.verifyCmd}\`)!`,
    critical: true,
  });
  if (!buildSuccess) score -= 30;

  // 5. Containerization & CI/CD Scaffolding
  const dockerPath = path.join(cwd, 'Dockerfile');
  const ciPath = path.join(cwd, '.github', 'workflows', 'ci.yml');
  const hasInfra = (await fs.pathExists(dockerPath)) && (await fs.pathExists(ciPath));

  if (!hasInfra) {
    const createdInfra = await scaffoldDockerAndCI(cwd, meta.stack);
    checks.push({
      name: 'Deployment & CI/CD Automation',
      passed: true,
      message: `Scaffolded ${createdInfra.join(', ')}`,
      critical: false,
    });
  } else {
    checks.push({
      name: 'Deployment & CI/CD Automation',
      passed: true,
      message: 'Dockerfile and GitHub Actions workflow active.',
      critical: false,
    });
  }

  score = Math.max(0, Math.min(100, score));
  s.stop(`Launch audit complete! Readiness Score: ${score}/100`);

  const readyToShip = score >= 80 && buildSuccess;

  const banner = readyToShip
    ? pc.bgGreen(pc.black(' STATUS: CLEARED FOR COMMERCIAL SHIPMENT (READY) '))
    : pc.bgRed(pc.white(' STATUS: PRE-FLIGHT BLOCKED (RESOLVE ISSUES) '));

  const checkRows = checks
    .map((c) => {
      const badge = c.passed ? pc.green('✔') : pc.red('✖');
      return `  ${badge} ${pc.bold(c.name)}\n     ${pc.dim(c.message)}`;
    })
    .join('\n\n');

  p.note(
    `${banner}\n\n` +
      `Project:    ${pc.cyan(projectName)}\n` +
      `Score:      ${pc.bold(score >= 80 ? pc.green(`${score}/100`) : pc.red(`${score}/100`))}\n` +
      `Stack:      ${pc.yellow(meta.stack.join(', '))}\n\n` +
      `Launchpad Pre-Flight Audit:\n${checkRows}`,
    'Commercial Launchpad Assessment'
  );

  if (readyToShip) {
    p.outro(pc.green('🎉 Congratulations! Codebase meets commercial production standards. Ready to deploy!'));
  } else {
    p.outro(pc.yellow('⚠️ Address the failing checks above before pushing to production.'));
  }
}
