import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates OpenHands (formerly OpenDevin) microagent harness target files.
 * Emits YAML frontmatter triggers and agent instructions.
 */
export function generateOpenHandsTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const triggers = [
    skill.name,
    ...skill.tools.map((t) => t.name),
    ...skill.tools.map((t) => t.name.replace(/_/g, ' ')),
  ];
  const uniqueTriggers = Array.from(new Set(triggers));

  const content = `---
name: ${skill.name}
agent: CodeActAgent
triggers:
${uniqueTriggers.map((tr) => `  - "${tr}"`).join('\n')}
---

# ${skill.name} Microagent

## Description
${skill.description}

## Tools and Guidelines
Execute tools using the node runner at \`scripts/run.js\`:

${skill.tools
  .map(
    (t) => `### \`${t.name}\` [${t.riskLevel}]
${t.description}
Parameters schema: \`${JSON.stringify(t.parameters.properties)}\`
Command: \`node scripts/run.js ${t.name} '<json-args>'\``
  )
  .join('\n\n')}

## Security Guardrails
- Tools marked \`destructive_write\` require explicit user confirmation with \`"confirm": true\`.
- All file paths are sandboxed against directory traversal.
`.trim();

  files.push({
    relativePath: `.openhands/microagents/${skill.name}.md`,
    content,
    description: 'OpenHands microagent definition with keyword triggers and tool contracts',
  });

  return files;
}
