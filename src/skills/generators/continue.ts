import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates Continue.dev IDE extension harness target files (continue-config.json).
 */
export function generateContinueTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const continueConfig = {
    mcpServers: [
      {
        name: skill.name,
        command: 'node',
        args: ['./mcp-server.js'],
      },
    ],
  };

  files.push({
    relativePath: 'continue-config.json',
    content: JSON.stringify(continueConfig, null, 2),
    description: 'Continue.dev IDE extension MCP server configuration snippet',
  });

  return files;
}
