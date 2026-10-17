import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates Nous Hermes Agent harness target files (hermes-tools.json, hermes-prompt.md, and skill.yaml).
 * Follows the Nous Hermes <tools> / <tool_call> function calling standard and ~/.hermes/skills architecture.
 */
export function generateHermesTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. hermes-tools.json (Nous Hermes function definitions)
  const hermesFunctions = skill.tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  files.push({
    relativePath: 'hermes-tools.json',
    content: JSON.stringify(hermesFunctions, null, 2),
    description: 'Nous Hermes Agent JSON function calling definitions',
  });

  // 2. hermes-prompt.md (System prompt fragment with <tools> block and <tool_call> syntax)
  const sampleTool = skill.tools[0];
  const sampleCall = sampleTool
    ? `<tool_call>{"name": "${sampleTool.name}", "arguments": {}}</tool_call>`
    : '';

  const promptContent = `# Hermes Agent Skill: ${skill.name}

You have access to the following tools via the Hermes function calling interface:

<tools>
${JSON.stringify(hermesFunctions, null, 2)}
</tools>

## Tool Calling Instructions
When a user asks to invoke a tool, respond with a valid \`<tool_call>\` tag containing the function name and JSON arguments:
${sampleCall}

${skill.tools.some((t) => t.riskLevel === 'destructive_write') ? '> Caution: Contains destructive tools. Enforce user confirmation before invocation.\n' : ''}
## Guardrails
All tool invocations are guarded by the Vibe Engine deterministic safety sandbox. Path traversal (..) and SSRF metadata addresses are blocked automatically.
`.trim();

  files.push({
    relativePath: 'hermes-prompt.md',
    content: promptContent,
    description: 'Hermes system prompt with <tools> XML tags and invocation instructions',
  });

  // 3. skill.yaml (Hermes Agent skill metadata manifest)
  const yamlContent = `name: ${skill.name}
version: ${skill.version}
description: "${skill.description.replace(/"/g, '\\"')}"
author: vibe-cli
entrypoint: scripts/run.js
riskLevel: ${skill.tools[0]?.riskLevel || 'read_only'}
tools:
${skill.tools.map((t) => `  - name: ${t.name}\n    risk: ${t.riskLevel}`).join('\n')}
`;

  files.push({
    relativePath: 'skill.yaml',
    content: yamlContent,
    description: 'Nous Hermes Agent native skill.yaml manifest',
  });

  return files;
}
