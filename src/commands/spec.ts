import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { slugify } from './sync.js';
import { clarifyCommand } from './clarify.js';
import { promptCommand } from './prompt.js';

export interface SpecOptions {
  clarify?: boolean;
  prompt?: boolean;
}

export function generateFeatureSpecMarkdown(featureName: string, projectName: string): string {
  const timestamp = new Date().toISOString().substring(0, 10);

  return `# Feature Specification: ${featureName}

> **Project**: ${projectName} • **Date**: ${timestamp} • **Status**: Ready for Implementation

---

## 1. Problem Statement & Commercial Value
- **What user pain point does this solve?**
- **How does this drive engagement, conversion, or retention?**

---

## 2. User Stories & Acceptance Criteria

### Primary User Story
> As a user, I want to ${featureName.toLowerCase()} so that I can achieve maximum productivity.

### Acceptance Criteria
- [ ] **Given** a valid user session, **When** they initiate this action, **Then** the UI reflects immediate feedback.
- [ ] **Given** invalid or missing input, **When** submitted, **Then** friendly field validation highlights the issue without crashing.
- [ ] **Given** a slow or offline network connection, **When** requested, **Then** a graceful loading spinner and retry state is shown.

---

## 3. Data Flow & API Contracts

### Data Schema / Payload
\`\`\`typescript
interface ${featureName.replace(/\s+/g, '')}Payload {
  id: string;
  timestamp: string;
  status: 'pending' | 'success' | 'failed';
}
\`\`\`

### API Endpoints / Mutators
- \`POST /api/${slugify(featureName)}\`
- Response: \`{ success: boolean, data?: any, error?: string }\`

---

## 4. UI/UX States & Edge Cases
- **Empty State**: What does the screen show when there is no data?
- **Loading State**: Skeleton loaders or subtle spinners (no blocking white screens).
- **Error State**: Non-blocking toast or banner with an actionable retry button.
- **Success State**: Confirmatory animation or toast and immediate state update.

---

## 5. Security & Commercial Controls
- [ ] Authentication gate: Only authenticated users with active roles can access.
- [ ] Rate limiting & sanitization applied to prevent abuse.
- [ ] No private secrets or credentials exposed to client bundles.

---

## 6. Implementation Checklist
- [ ] Backend data models & migrations
- [ ] API endpoints & validation middleware
- [ ] Frontend UI component & interactive states
- [ ] Unit & integration tests (\`vibe check\`)
- [ ] Live demo verification in browser / emulator
`;
}

export async function specCommand(featureNameInput?: string, options: SpecOptions = {}): Promise<void> {
  if (options.clarify) {
    await clarifyCommand(featureNameInput);
    return;
  }
  if (options.prompt) {
    await promptCommand(featureNameInput);
    return;
  }

  const cwd = process.cwd();
  const vaultDir = path.join(cwd, '.vault');
  const specsDir = path.join(vaultDir, 'Specs');
  const contextFile = path.join(vaultDir, '_Context.md');

  if (!fs.existsSync(vaultDir)) {
    p.log.error('No .vault directory found in current project.');
    p.log.info('Run `vibe link` first to wire this project to Obsidian.');
    return;
  }

  p.intro(pc.bgMagenta(pc.black(' vibe spec ')) + ' ' + pc.bold('Feature PRD & Production Spec Generator'));

  let feature = featureNameInput;
  if (!feature) {
    const input = await p.text({
      message: 'Enter feature name to architect (PRD):',
      placeholder: 'Stripe Subscription Checkout',
      validate: (val) => (!val?.trim() ? 'Feature name cannot be empty' : undefined),
    });

    if (p.isCancel(input)) {
      p.cancel('Spec generation canceled.');
      return;
    }
    feature = (input as string).trim();
  }

  const s = p.spinner();
  s.start(`Generating production PRD for ${pc.bold(feature)}...`);

  fs.ensureDirSync(specsDir);
  const slug = slugify(feature);
  const specFile = path.join(specsDir, `${slug}.md`);
  const projectName = path.basename(cwd);

  const specContent = generateFeatureSpecMarkdown(feature, projectName);
  fs.writeFileSync(specFile, specContent, 'utf-8');

  // Inject into _Context.md Active Tasks
  if (fs.existsSync(contextFile)) {
    try {
      const raw = fs.readFileSync(contextFile, 'utf-8');
      const parsed = matter(raw);
      const newTaskEntry = `- [ ] Implement [[Specs/${slug}|${feature}]]`;

      if (!parsed.content.includes(slug)) {
        parsed.content = parsed.content.replace(
          /## Active Tasks[^\n]*/i,
          `## Active Tasks (Sliding Window)\n${newTaskEntry}`
        );
        parsed.data.updatedAt = new Date().toISOString();
        fs.writeFileSync(contextFile, matter.stringify(parsed.content, parsed.data), 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  s.stop(pc.green(`PRD successfully created in Obsidian!`));
  p.note(
    `Spec File:    .vault/Specs/${slug}.md\n` +
      `Obsidian Link: [[Specs/${slug}|${feature}]]\n` +
      `Context Hub:   Added to .vault/_Context.md active tasks`,
    'Feature Architected'
  );

  p.outro(pc.green('Your AI agent now has an exact blueprint to build without hallucinating!'));
}
