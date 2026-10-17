import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates Goose (Block) agent harness target files (goose-extension.yaml and .goosehints).
 * Conforms to Goose's YAML extension specification for stdio MCP execution.
 */
export function generateGooseTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. goose-extension.yaml snippet for ~/.config/goose/config.yaml
  const extensionYaml = `extensions:
  ${skill.name}:
    enabled: true
    type: stdio
    cmd: node
    args:
      - ./mcp-server.js
    envs:
      VIBE_GUARDRAILS_ENABLED: "true"
`;

  files.push({
    relativePath: 'goose-extension.yaml',
    content: extensionYaml,
    description: 'Goose (Block) agent MCP extension configuration YAML snippet',
  });

  // 2. .goosehints context guide for the agent
  const hintsContent = `# Goose Hints: ${skill.name}

Use the \`${skill.name}\` extension for: ${skill.description}

## Available Extension Tools
${skill.tools.map((t) => `- \`${t.name}\`: ${t.description} [${t.riskLevel}]`).join('\n')}

## Security & Guardrails
- Tools marked with destructive risk require user confirmation.
- Path traversal and private IP calls are blocked deterministically.
`.trim();

  files.push({
    relativePath: '.goosehints',
    content: hintsContent,
    description: 'Goose project-level hints and safe tool invocation rules',
  });

  return files;
}
