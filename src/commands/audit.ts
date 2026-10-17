import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { inspectProject } from '../inspector.js';

export interface AuditFinding {
  title: string;
  category: 'Security' | 'Monetization & Auth' | 'UI/UX & Polish' | 'Observability';
  status: 'pass' | 'warn' | 'fail';
  description: string;
  recommendation?: string;
}

export interface AuditReport {
  score: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Work';
  findings: AuditFinding[];
}

export async function runProductionAudit(projectPath: string): Promise<AuditReport> {
  const resolved = path.resolve(projectPath);
  const meta = await inspectProject(resolved);
  const findings: AuditFinding[] = [];

  const pkgJsonPath = path.join(resolved, 'package.json');
  let allDeps: Record<string, string> = {};
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = fs.readJsonSync(pkgJsonPath);
      allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    } catch {
      // ignore
    }
  }

  // 1. Security & Secrets Protection
  const gitIgnorePath = path.join(resolved, '.gitignore');
  const hasGitIgnore = fs.existsSync(gitIgnorePath);
  let gitIgnoreContent = '';
  if (hasGitIgnore) {
    gitIgnoreContent = fs.readFileSync(gitIgnorePath, 'utf-8');
  }

  if (hasGitIgnore && (gitIgnoreContent.includes('.env') || gitIgnoreContent.includes('*.env'))) {
    findings.push({
      title: 'Environment Variables Shielded',
      category: 'Security',
      status: 'pass',
      description: '.env files are explicitly ignored in .gitignore.',
    });
  } else {
    findings.push({
      title: 'Exposed Secrets Risk (.env)',
      category: 'Security',
      status: 'fail',
      description: '.env is not ignored in .gitignore. You risk leaking API keys to GitHub!',
      recommendation: 'Add ".env" and ".env.*" to your .gitignore immediately.',
    });
  }

  // Check for .env.example
  const hasEnvExample = fs.existsSync(path.join(resolved, '.env.example'));
  if (hasEnvExample) {
    findings.push({
      title: 'Public Environment Template',
      category: 'Security',
      status: 'pass',
      description: '.env.example exists to document required API keys for collaborators and CI.',
    });
  } else {
    findings.push({
      title: 'Missing .env.example',
      category: 'Security',
      status: 'warn',
      description: 'Collaborators or fresh clones will not know what environment variables are needed.',
      recommendation: 'Create a .env.example with dummy values (e.g. STRIPE_KEY=your_key_here).',
    });
  }

  // 2. Monetization & Payment Infrastructure
  const paymentPackages = ['stripe', '@stripe/stripe-js', '@lemonsqueezy/lemonsqueezy.js', '@paypal/checkout-server-sdk', 'paddle-sdk'];
  const detectedPayment = paymentPackages.find((pkg) => allDeps[pkg]);

  if (detectedPayment) {
    findings.push({
      title: 'Payment Gateway Integrated',
      category: 'Monetization & Auth',
      status: 'pass',
      description: `Detected payment infrastructure (${detectedPayment}). Ready to collect revenue!`,
    });
  } else {
    findings.push({
      title: 'No Payment Provider Detected',
      category: 'Monetization & Auth',
      status: 'warn',
      description: 'No billing SDK (Stripe, Lemon Squeezy, Paddle) detected in dependencies.',
      recommendation: 'To generate revenue, integrate Stripe Checkout or Lemon Squeezy for payments.',
    });
  }

  // Auth Infrastructure
  const authPackages = [
    'next-auth',
    '@auth/core',
    'lucia',
    '@clerk/nextjs',
    '@clerk/clerk-react',
    '@supabase/supabase-js',
    'firebase',
    'firebase-admin',
    'passport',
    'jsonwebtoken',
  ];
  const detectedAuth = authPackages.find((pkg) => allDeps[pkg]);

  if (detectedAuth) {
    findings.push({
      title: 'Authentication System Configured',
      category: 'Monetization & Auth',
      status: 'pass',
      description: `Detected auth provider (${detectedAuth}). Users can sign up and login safely.`,
    });
  } else {
    findings.push({
      title: 'No Authentication Provider Detected',
      category: 'Monetization & Auth',
      status: 'warn',
      description: 'No standard auth provider (Clerk, Supabase, Firebase, NextAuth) detected.',
      recommendation: 'Protect paying user accounts with a solid auth provider before launch.',
    });
  }

  // 3. UI/UX & Production Polish
  if (meta.category === 'Web App') {
    const publicDir = path.join(resolved, 'public');
    const hasFavicon =
      fs.existsSync(path.join(publicDir, 'favicon.ico')) ||
      fs.existsSync(path.join(publicDir, 'favicon.svg')) ||
      fs.existsSync(path.join(resolved, 'favicon.ico'));

    if (hasFavicon) {
      findings.push({
        title: 'Brand Favicon Present',
        category: 'UI/UX & Polish',
        status: 'pass',
        description: 'Favicon is configured, giving your web application professional browser tab branding.',
      });
    } else {
      findings.push({
        title: 'Missing Custom Favicon',
        category: 'UI/UX & Polish',
        status: 'warn',
        description: 'Missing custom favicon. Default framework icons (like Vite or React) signal a non-production toy.',
        recommendation: 'Add a high-resolution favicon.ico or favicon.svg to public/.',
      });
    }
  }

  // Mobile App specific checks
  if (meta.category === 'Mobile App' || meta.stack.includes('Flutter')) {
    const hasPubspec = fs.existsSync(path.join(resolved, 'pubspec.yaml'));
    if (hasPubspec) {
      findings.push({
        title: 'Mobile Architecture Configured',
        category: 'UI/UX & Polish',
        status: 'pass',
        description: 'Flutter mobile package detected with valid pubspec definition.',
      });
    }
  }

  // 4. Observability & Crash Analytics
  const observabilityPackages = ['@sentry/react', '@sentry/nextjs', '@sentry/node', 'posthog-js', 'mixpanel-browser', 'logrocket'];
  const detectedObs = observabilityPackages.find((pkg) => allDeps[pkg]);

  if (detectedObs) {
    findings.push({
      title: 'Crash & Product Analytics Active',
      category: 'Observability',
      status: 'pass',
      description: `Telemetry detected (${detectedObs}). You will catch errors before paying users complain.`,
    });
  } else {
    findings.push({
      title: 'Missing Production Telemetry',
      category: 'Observability',
      status: 'warn',
      description: 'No error tracker (Sentry) or user analytics (PostHog) detected.',
      recommendation: 'Install Sentry or PostHog to monitor application crashes and user retention.',
    });
  }

  // Calculate score
  const passCount = findings.filter((f) => f.status === 'pass').length;
  const warnCount = findings.filter((f) => f.status === 'warn').length;
  const failCount = findings.filter((f) => f.status === 'fail').length;

  const totalPoints = findings.length * 10;
  const earnedPoints = passCount * 10 + warnCount * 5;
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 50;

  let grade: AuditReport['grade'] = 'Needs Work';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';

  return { score, grade, findings };
}

export async function auditCommand(targetDir?: string): Promise<void> {
  const dir = targetDir ? path.resolve(targetDir) : process.cwd();

  p.intro(pc.bgMagenta(pc.black(' vibe audit ')) + ' ' + pc.bold('Pro Production & Commercial Readiness Audit'));

  const s = p.spinner();
  s.start(`Auditing ${pc.bold(path.basename(dir))} across Security, Monetization, UX, and Observability...`);

  const report = await runProductionAudit(dir);
  s.stop('Audit complete!');

  const gradeColor =
    report.grade === 'A+' || report.grade === 'A'
      ? pc.green(report.grade)
      : report.grade === 'B'
      ? pc.cyan(report.grade)
      : pc.yellow(report.grade);

  p.note(
    `Overall Score:  ${pc.bold(pc.white(String(report.score)))} / 100\n` +
      `Launch Grade:   ${pc.bold(gradeColor)}\n` +
      `Verdict:        ${
        report.score >= 80
          ? pc.green('Commercial grade software. Ready to ship and monetize!')
          : pc.yellow('Solid foundation. Address warning recommendations to maximize revenue.')
      }`,
    'Audit Results'
  );

  for (const finding of report.findings) {
    const symbol =
      finding.status === 'pass'
        ? pc.green('✓')
        : finding.status === 'warn'
        ? pc.yellow('!')
        : pc.red('✗');

    let body = `Category: ${pc.dim(finding.category)}\nDetails:  ${finding.description}`;
    if (finding.recommendation) {
      body += `\nFix:      ${pc.cyan(finding.recommendation)}`;
    }

    p.note(body, `${symbol} ${finding.title}`);
  }

  p.outro(pc.green('Audit finished. Build profitable software with confidence!'));
}
