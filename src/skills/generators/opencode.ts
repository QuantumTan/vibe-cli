import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates OpenCode harness target files (opencode.json and opencode-tools.json).
 * Conforms to OpenCode's MCP server specification and permission architecture.
 */
export function generateOpenCodeTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const hasDestructive = skill.tools.some((t) => t.riskLevel === 'destructive_write');
  const hasPrivileged = skill.tools.some((t) => t.riskLevel === 'privileged');

  // 1. opencode.json configuration
  const opencodeConfig = {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      [skill.name]: {
        type: 'local',
        command: ['node', './mcp-server.js'],
        enabled: true,
      },
    },
    permission: {
      [`${skill.name}_*`]: hasDestructive || hasPrivileged ? 'ask' : 'allow',
    },
  };

  files.push({
    relativePath: 'opencode.json',
    content: JSON.stringify(opencodeConfig, null, 2),
    description: 'OpenCode harness MCP server configuration and safety permission policy',
  });

  // 2. opencode-tools.json function declarations
  const opencodeTools = {
    name: skill.name,
    version: skill.version,
    description: skill.description,
    tools: skill.tools.map((t) => ({
      name: t.name,
      description: t.description,
      riskLevel: t.riskLevel,
      parameters: t.parameters,
    })),
  };

  files.push({
    relativePath: 'opencode-tools.json',
    content: JSON.stringify(opencodeTools, null, 2),
    description: 'OpenCode declarative tool schema definitions',
  });

  return files;
}
