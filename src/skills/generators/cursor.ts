import { SkillIR, GeneratedFile } from '../types.js';

export function generateCursorTarget(skill: SkillIR): GeneratedFile[] {
  let content = `# VIBE SKILL: ${skill.name} (v${skill.version})
# ${skill.description}

You have access to the following local tools in the '${skill.name}' skill suite.
When invoking these tools or generating commands for them, follow the strict parameter contracts and security guardrails below.

## Tools Specification

`;

  for (const tool of skill.tools) {
    content += `### Tool: \`${tool.name}\`\n`;
    content += `- **Risk Level**: ${tool.riskLevel}\n`;
    content += `- **Description**: ${tool.description}\n`;
    content += `- **Parameters**:\n`;

    const props = tool.parameters.properties;
    const required = tool.parameters.required || [];

    if (Object.keys(props).length === 0) {
      content += `  - No parameters required.\n`;
    } else {
      for (const [key, prop] of Object.entries(props)) {
        const reqStr = required.includes(key) ? 'REQUIRED' : 'optional';
        content += `  - \`${key}\` (${prop.type}, ${reqStr}): ${prop.description || ''}\n`;
      }
    }
    content += '\n';
  }

  content += `## Safety & Operating Rules
1. **Never bypass guardrails**: Any destructive actions MUST be preceded by asking the user and specifying 'confirm: true'.
2. **Path traversal ban**: Never pass paths with '../' or paths targeting system files (/etc, System32).
3. **SSRF protection**: Cloud metadata addresses (169.254.169.254) are strictly blocked.
4. **Dry-run preferred**: For risky operations, run with 'dryRun: true' first to display impact to the user before mutating.
`;

  return [
    {
      relativePath: '.cursorrules',
      content,
      description: 'Cursor IDE Agent System Rules & Tool Manifest',
    },
    {
      relativePath: '.windsurfrules',
      content,
      description: 'Windsurf IDE Agent System Rules & Tool Manifest',
    },
  ];
}
