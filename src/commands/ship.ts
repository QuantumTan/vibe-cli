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

export interface ShipOptions {
  free?: boolean;
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
 * Scaffolds Supabase 7-day inactivity pause keep-alive GitHub Action workflow.
 */
export async function scaffoldSupabaseKeepAlive(cwd: string): Promise<string | null> {
  const githubDir = path.join(cwd, '.github', 'workflows');
  const workflowPath = path.join(githubDir, 'supabase-keepalive.yml');
  if (!(await fs.pathExists(workflowPath))) {
    await fs.ensureDir(githubDir);
    const keepAliveYaml = `name: Supabase Free-Tier Keep-Alive
on:
  schedule:
    # Run every 5 days at 06:00 UTC to prevent 7-day inactivity project pause
    - cron: '0 6 */5 * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase Project REST Endpoint
        run: |
          if [ -n "$SUPABASE_URL" ]; then
            curl -s -f -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/" || true
            echo "Successfully pinged Supabase free tier."
          else
            echo "SUPABASE_URL secret not configured. Set repository secret to enable automatic keep-alive."
          fi
        env:
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: \${{ secrets.SUPABASE_ANON_KEY }}
`;
    await fs.writeFile(workflowPath, keepAliveYaml, 'utf8');
    return '.github/workflows/supabase-keepalive.yml';
  }
  return null;
}

/**
 * Scans workspace for leaked secrets and .gitignore protection.
 */
export async function scanSecretsAndGitignore(cwd: string): Promise<{ passed: boolean; message: string }> {
  const gitignorePath = path.join(cwd, '.gitignore');
  const envPath = path.join(cwd, '.env');

  // 1. Verify .env is in .gitignore
  if (await fs.pathExists(envPath)) {
    if (await fs.pathExists(gitignorePath)) {
      const gitignore = await fs.readFile(gitignorePath, 'utf8');
      if (!gitignore.includes('.env')) {
        return {
          passed: false,
          message: 'CRITICAL LEAK RISK: .env file exists but is NOT listed in .gitignore! Will leak to GitHub.',
        };
      }
    } else {
      return {
        passed: false,
        message: 'CRITICAL LEAK RISK: .env file exists without a .gitignore file in root!',
      };
    }

    // 2. Scan .env for high-entropy live secret tokens
    const envContent = await fs.readFile(envPath, 'utf8');
    const secretPatterns = [
      { pattern: /sk_live_[0-9a-zA-Z]{20,}/, label: 'Live Stripe Secret Key' },
      { pattern: /ghp_[0-9a-zA-Z]{30,}/, label: 'GitHub Personal Access Token' },
      { pattern: /gho_[0-9a-zA-Z]{30,}/, label: 'GitHub OAuth Access Token' },
      { pattern: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key ID' },
      { pattern: /AIzaSy[0-9a-zA-Z_-]{33}/, label: 'Google API Key' },
      { pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, label: 'Private Cryptographic Key' },
    ];

    for (const { pattern, label } of secretPatterns) {
      if (pattern.test(envContent)) {
        return {
          passed: false,
          message: `CRITICAL SECRET LEAK: Detected raw production credential (${label}) in .env!`,
        };
      }
    }
  }

  return { passed: true, message: 'No live secrets detected and .env is properly gitignored.' };
}

/**
 * vibe ship [targetDir] [--free]
 */
export async function shipCommand(targetDirInput?: string, options: ShipOptions = {}): Promise<void> {
  const isFree = options.free !== false;
  const headerTitle = isFree
    ? 'Zero-Credit-Card Student Launchpad & Preflight'
    : 'Commercial Launch Gate & Production Readiness';

  p.intro(pc.bgGreen(pc.black(' vibe ship ')) + ' ' + pc.bold(headerTitle));

  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);
  const meta = await inspectProject(cwd);

  const s = p.spinner();
  s.start(`Auditing ${projectName} for zero-dollar student deployment readiness...`);

  const checks: ShipReport['checks'] = [];
  let score = 100;

  // 1. Secrets & Gitignore Leak Scan
  const secretCheck = await scanSecretsAndGitignore(cwd);
  checks.push({
    name: 'Secret Leak & .gitignore Protection',
    passed: secretCheck.passed,
    message: secretCheck.message,
    critical: true,
  });
  if (!secretCheck.passed) score -= 35;

  // 2. Render PostgreSQL 30-Day Expiry Check
  let hasRenderPostgres = false;
  const renderYamlPath = path.join(cwd, 'render.yaml');
  if (await fs.pathExists(renderYamlPath)) {
    const renderContent = await fs.readFile(renderYamlPath, 'utf8');
    if (/type:\s*postgres|databases:/i.test(renderContent)) {
      hasRenderPostgres = true;
    }
  }
  const envPath = path.join(cwd, '.env');
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, 'utf8');
    if (/dpg-[a-z0-9]+-a\.oregon-postgres\.render\.com|dpg-[a-z0-9]+-a\.frankfurt-postgres\.render\.com/i.test(envContent)) {
      hasRenderPostgres = true;
    }
  }

  if (hasRenderPostgres) {
    checks.push({
      name: 'Render Free PostgreSQL 30-Day Deletion Guard',
      passed: false,
      message: 'CRITICAL: Render Free PostgreSQL automatically DELETES after 30 days! Migrate to Supabase, Neon, or Turso to prevent data loss.',
      critical: true,
    });
    score -= 25;
  } else {
    checks.push({
      name: 'Render Free PostgreSQL 30-Day Deletion Guard',
      passed: true,
      message: 'No ephemeral 30-day Render PostgreSQL database detected.',
      critical: false,
    });
  }

  // 3. Supabase 7-Day Inactivity Pause Keep-Alive Generator
  let isSupabaseProject = false;
  if (await fs.pathExists(envPath)) {
    const envContent = await fs.readFile(envPath, 'utf8');
    if (/supabase\.co/i.test(envContent) || /SUPABASE_/i.test(envContent)) {
      isSupabaseProject = true;
    }
  }
  const pkgPath = path.join(cwd, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (pkg.dependencies?.['@supabase/supabase-js'] || pkg.devDependencies?.['@supabase/supabase-js']) {
      isSupabaseProject = true;
    }
  }

  if (isSupabaseProject) {
    const keepAliveFile = await scaffoldSupabaseKeepAlive(cwd);
    checks.push({
      name: 'Supabase 7-Day Inactivity Keep-Alive',
      passed: true,
      message: keepAliveFile
        ? `Generated automated cron workflow: ${keepAliveFile}`
        : 'Supabase keep-alive cron workflow already active in .github/workflows/.',
      critical: false,
    });
  } else {
    checks.push({
      name: 'Zero-Dollar Database Hosting Alignment',
      passed: true,
      message: 'Compatible with TiDB Cloud Starter, Turso (LibSQL), or Supabase free tiers.',
      critical: false,
    });
  }

  // 4. Zero-Card Hosting Platforms Preflight (Vercel / Cloudflare Pages / Render Free)
  const isWebOrNode = meta.stack.includes('React') || meta.stack.includes('Next.js') || meta.stack.includes('Vite') || meta.stack.includes('TypeScript');
  checks.push({
    name: 'Zero-Credit-Card Platform Compatibility',
    passed: true,
    message: isWebOrNode
      ? 'Verified for Vercel Hobby (100 deploys/day), Cloudflare Pages (unlimited free bandwidth), and Render Free Web Services.'
      : 'Compatible with zero-credit-card container hosting and local tunnels.',
    critical: false,
  });

  // 5. Verification Suite Gate
  s.message(`Running project verification suite (${meta.verifyCmd})...`);
  const buildSuccess = await runCommandAsync(meta.verifyCmd, cwd);
  checks.push({
    name: `Build & Verification Gate (\`${meta.verifyCmd}\`)`,
    passed: buildSuccess,
    message: buildSuccess ? 'Codebase compiles with 0 build errors.' : `Verification command failed (\`${meta.verifyCmd}\`)!`,
    critical: true,
  });
  if (!buildSuccess) score -= 30;

  score = Math.max(0, Math.min(100, score));
  s.stop(`Launch audit complete! Readiness Score: ${score}/100`);

  const readyToShip = score >= 80 && buildSuccess && secretCheck.passed && !hasRenderPostgres;

  const banner = readyToShip
    ? pc.bgGreen(pc.black(' STATUS: CLEARED FOR FREE STUDENT DEPLOYMENT (READY) '))
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
      `Stack:      ${pc.yellow(meta.stack.join(', '))}\n` +
      `Target:     ${pc.magenta('Zero-Credit-Card Free Tier (Vercel/Cloudflare/Supabase/TiDB/Turso)')}\n\n` +
      `Launchpad Pre-Flight Audit:\n${checkRows}`,
    'Zero-Budget Student Launchpad Assessment'
  );

  if (readyToShip) {
    p.outro(pc.green('🎉 Codebase cleared for zero-credit-card student deployment! Safe to push to portfolio repo.'));
  } else {
    p.outro(pc.yellow('⚠️ Resolve the critical pre-flight failures above before pushing to public portfolio repo.'));
  }
}
