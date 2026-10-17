import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates Claude Code (Anthropic CLI) harness target files (.claude/mcp.json and CLAUDE.md).
 * Conforms to Anthropic's terminal CLI agent standard.
 */
export function generateClaudeCodeTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. .claude/mcp.json
  const mcpConfig = {
    mcpServers: {
      [skill.name]: {
        command: 'node',
        args: ['./mcp-server.js'],
      },
    },
  };

  files.push({
    relativePath: pathJoin('.claude', 'mcp.json'),
    content: JSON.stringify(mcpConfig, null, 2),
    description: 'Claude Code project MCP server configuration',
  });

  // 2. CLAUDE.md guidelines snippet
  const claudeMd = `# Claude Code Skill Guidelines: ${skill.name}

This project has the \`${skill.name}\` AI skill suite installed.

## Description
${skill.description}

## Available Tools
${skill.tools
  .map(
    (t) => `### \`${t.name}\` (${t.riskLevel})
${t.description}
Parameters: \`${JSON.stringify(t.parameters.properties)}\``
  )
  .join('\n\n')}

## Guardrails Policy
All invocations run inside the Vibe Engine sandbox. Destructive mutations require explicit confirmation.
`.trim();

  files.push({
    relativePath: 'CLAUDE.md',
    content: claudeMd,
    description: 'Claude Code repository guidelines and tool usage reference',
  });

  return files;
}

function pathJoin(...parts: string[]): string {
  return parts.join('/');
}
