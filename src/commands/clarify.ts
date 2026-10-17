import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { slugify } from './sync.js';
import { copyToClipboard } from './prompt.js';

export function generateArchitectPrdMarkdown(
  feature: string,
  projectName: string,
  answers: {
    persistence: string;
    auth: string;
    resilience: string;
    latency: string;
    commercial: string;
  }
): string {
  const dateStr = new Date().toISOString().substring(0, 10);
  const typeName = feature.replace(/[^a-zA-Z0-9]/g, '');

  return `# Production PRD: ${feature}

> **Project**: ${projectName} • **Date**: ${dateStr} • **Architect Status**: Locked & Clarified

---

## 1. Commercial Objective & Problem Definition
- **Commercial Goal**: Deliver high-velocity, production-grade implementation of **${feature}**.
- **User Pain Point**: Eliminate manual friction and provide immediate user value with zero UI latency or state corruption.

---

## 2. Locked Architectural Decisions (Clarified)

| Dimension | Selected Architectural Standard |
| :--- | :--- |
| **Data & Persistence** | \`${answers.persistence}\` |
| **Auth & Security Boundary** | \`${answers.auth}\` |
| **Failure & Resilience** | \`${answers.resilience}\` |
| **Latency Profile** | \`${answers.latency}\` |
| **Commercial Controls** | \`${answers.commercial}\` |

---

## 3. Data Flow & API Contract

### Typed Data Schema
\`\`\`typescript
export interface ${typeName}Payload {
  id: string;
  timestamp: string;
  status: 'pending' | 'active' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface ${typeName}Response {
  success: boolean;
  data?: ${typeName}Payload;
  error?: {
    code: string;
    message: string;
  };
}
\`\`\`

### API Mutator Signature
- **Endpoint**: \`POST /api/${slugify(feature)}\`
- **Security Guard**: \`${answers.auth}\`
- **Error Behavior**: \`${answers.resilience}\`

---

## 4. Acceptance Criteria & Verification (Gherkin Format)

- [ ] **Given** a valid authenticated session, **When** the user initiates \`${feature}\`, **Then** state is persisted via \`${answers.persistence}\` and returns within specified latency.
- [ ] **Given** invalid or malicious payload, **When** submitted, **Then** request is rejected before database mutation with a clean validation error.
- [ ] **Given** network failure or downstream timeout, **When** executing, **Then** \`${answers.resilience}\` kicks in without corrupting state.
- [ ] **Given** commercial constraints, **When** accessed, **Then** \`${answers.commercial}\` is enforced.

---

## 5. Anti-Slop Implementation Directives
1. **No generic placeholders**: Implement complete, production-ready types and handlers.
2. **Strict schema validation**: Validate all incoming parameters at the route boundary before processing.
3. **Deterministic error boundaries**: Return typed error objects rather than throwing unhandled exceptions.
4. **Verified via Tests**: Run verification suite (\`vibe check\`) to confirm 100% test pass rate.
`;
}

/**
 * vibe clarify [feature]
 */
export async function clarifyCommand(featureNameInput?: string): Promise<void> {
  p.intro(pc.bgMagenta(pc.black(' vibe clarify ')) + ' ' + pc.bold('Principal Architect Feature Interview'));

  let feature = featureNameInput;

  if (!feature) {
    const input = await p.text({
      message: 'What feature or module are you preparing to build?',
      placeholder: 'Stripe Customer Checkout & Subscription Portal',
      validate: (val) => (!val?.trim() ? 'Feature name is required' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Clarification interview canceled.');
      return;
    }
    feature = input.trim();
  }

  p.note(
    `Answering 5 high-impact questions to lock down data flow, auth, resilience, and business logic.\n` +
      `This prevents AI hallucination, prompt drift, and messy mid-sprint refactors.`,
    `Architecting: ${feature}`
  );

  // Q1: Persistence
  const qPersistence = await p.select({
    message: '1. What is the Data & Persistence Strategy?',
    options: [
      { value: 'Relational DB (ACID transactions, migrations, foreign keys)', label: '🗄️ Relational DB (ACID transactions, migrations, foreign keys)' },
      { value: 'Document / NoSQL store (flexible schemas, fast key-value lookup)', label: '📄 Document / NoSQL store (flexible schemas, fast key lookup)' },
      { value: 'In-Memory Cache with async disk persistence (Redis / Keyv)', label: '⚡ In-Memory Cache with async disk persistence (Redis / Keyv)' },
      { value: 'Serverless Edge DB (Cloudflare D1 / Turso / Supabase)', label: '🌐 Serverless Edge DB (Cloudflare D1 / Turso / Supabase)' },
    ],
  });
  if (p.isCancel(qPersistence)) return;

  // Q2: Auth
  const qAuth = await p.select({
    message: '2. What is the Authentication & Security Boundary?',
    options: [
      { value: 'Role-Based Access Control (RBAC with admin, member, owner)', label: '🛡️ Role-Based Access Control (RBAC with admin, member, owner)' },
      { value: 'Authenticated User Session / JWT Bearer', label: '🔑 Authenticated User Session / JWT Bearer' },
      { value: 'Public endpoint with strict rate limiting & CAPTCHA', label: '🌍 Public endpoint with strict rate limiting & CAPTCHA' },
      { value: 'API Key with usage-based quota metering', label: '💳 API Key with usage-based quota metering' },
    ],
  });
  if (p.isCancel(qAuth)) return;

  // Q3: Resilience
  const qResilience = await p.select({
    message: '3. What is the Failure & Resilience Strategy?',
    options: [
      { value: 'Graceful degradation with exponential backoff retry', label: '🔄 Graceful degradation with exponential backoff retry' },
      { value: 'Atomic transactional rollback (all-or-nothing guarantee)', label: '🔒 Atomic transactional rollback (all-or-nothing guarantee)' },
      { value: 'Dead-letter queue with asynchronous background recovery worker', label: '📬 Dead-letter queue with background recovery worker' },
      { value: 'User-facing actionable banner with instant retry CTA', label: '⚠️ User-facing actionable banner with instant retry CTA' },
    ],
  });
  if (p.isCancel(qResilience)) return;

  // Q4: Latency
  const qLatency = await p.select({
    message: '4. What is the Performance & Latency Profile?',
    options: [
      { value: 'Real-time synchronous response (< 100ms)', label: '⚡ Real-time synchronous response (< 100ms)' },
      { value: 'Optimistic UI update with background reconciliation', label: '🎨 Optimistic UI update with background reconciliation' },
      { value: 'Queued asynchronous job with webhook or SSE progress notification', label: '⏳ Queued asynchronous job with webhook/SSE notification' },
      { value: 'Scheduled batch cron processing', label: '📅 Scheduled batch cron processing' },
    ],
  });
  if (p.isCancel(qLatency)) return;

  // Q5: Commercial
  const qCommercial = await p.select({
    message: '5. What Commercial & Production Controls are required?',
    options: [
      { value: 'Metered / Tier-gated monetization check (Stripe subscription required)', label: '💰 Metered / Tier-gated monetization check' },
      { value: 'Strict IP & User rate limiting (prevent scraping / DDoS abuse)', label: '🛑 Strict IP & User rate limiting (prevent abuse)' },
      { value: 'Immutable audit logging for compliance (GDPR / SOC2)', label: '📋 Immutable audit logging for compliance' },
      { value: 'Telemetry & real-time error tracking (Sentry / PostHog)', label: '📊 Telemetry & real-time error tracking (Sentry)' },
    ],
  });
  if (p.isCancel(qCommercial)) return;

  const s = p.spinner();
  s.start('Synthesizing clarified architectural PRD in Obsidian...');

  const cwd = process.cwd();
  const projectName = path.basename(cwd);
  const vaultDir = path.join(cwd, '.vault');
  const specsDir = path.join(vaultDir, 'Specs');
  const hasVault = await fs.pathExists(vaultDir);

  const fileSlug = slugify(feature);
  const targetDir = hasVault ? specsDir : path.join(cwd, 'specs');
  await fs.ensureDir(targetDir);

  const prdFile = path.join(targetDir, `${fileSlug}-PRD.md`);
  const prdContent = generateArchitectPrdMarkdown(feature, projectName, {
    persistence: qPersistence as string,
    auth: qAuth as string,
    resilience: qResilience as string,
    latency: qLatency as string,
    commercial: qCommercial as string,
  });

  await fs.writeFile(prdFile, prdContent, 'utf8');

  // Update _Context.md active tasks if in vault
  const contextFile = path.join(vaultDir, '_Context.md');
  if (hasVault && (await fs.pathExists(contextFile))) {
    try {
      const contextContent = await fs.readFile(contextFile, 'utf8');
      const taskLine = `- [ ] Implement [[Specs/${fileSlug}-PRD|${feature}]] (Architected via vibe clarify)`;
      if (!contextContent.includes(fileSlug)) {
        const updated = contextContent.replace('## Active Tasks', `## Active Tasks\n${taskLine}`);
        await fs.writeFile(contextFile, updated, 'utf8');
      }
    } catch {
      // Non-critical
    }
  }

  s.stop('Architectural PRD locked and saved!');

  const promptDirective = `Implement ${feature} according to specifications in .vault/Specs/${fileSlug}-PRD.md. Follow all locked architectural constraints.`;
  await copyToClipboard(promptDirective);

  p.note(
    `PRD Location: ${pc.cyan(prdFile)}\n\n` +
      `AI Prompt Copied to Clipboard:\n` +
      `${pc.bold(pc.white(promptDirective))}`,
    'Architect Interview Complete'
  );

  p.outro(pc.green('✔ Paste into Antigravity or Cursor to begin razor-sharp implementation!'));
}
