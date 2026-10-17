import { describe, it, expect } from 'vitest';
import { detectRiskLevel, synthesizeGuardrails } from '../src/skills/guardrails.js';
import {
  parsePythonScript,
  parseTypeScriptScript,
  parseNaturalLanguageIntent,
} from '../src/skills/parser.js';
import { compileSkill } from '../src/skills/compiler.js';
import { SkillTool } from '../src/skills/types.js';

describe('Skill Guardrail System', () => {
  it('correctly categorizes tool risk levels', () => {
    expect(detectRiskLevel('delete_old_records', 'Permanently drop tables')).toBe('destructive_write');
    expect(detectRiskLevel('update_user_status', 'Modify user record')).toBe('idempotent_write');
    expect(detectRiskLevel('get_account_balance', 'Fetch current balance')).toBe('read_only');
    expect(detectRiskLevel('grant_admin_role', 'Elevate permissions')).toBe('privileged');
  });

  it('synthesizes mandatory confirm guardrail for destructive tools', () => {
    const rawTool: SkillTool = {
      id: 'drop_database',
      name: 'drop_database',
      description: 'Wipe all tables in database',
      riskLevel: 'destructive_write',
      parameters: {
        type: 'object',
        properties: {
          db_name: { type: 'string', description: 'Database to drop' },
        },
        required: ['db_name'],
      },
      execution: { type: 'node' },
      guardrails: {},
    };

    const guarded = synthesizeGuardrails(rawTool);
    expect(guarded.guardrails.requireConfirmation).toBe(true);
    expect(guarded.guardrails.blockPathTraversal).toBe(true);
    expect(guarded.guardrails.blockSSRF).toBe(true);
    expect(guarded.parameters.properties['confirm']).toBeDefined();
    expect(guarded.parameters.properties['confirm'].type).toBe('boolean');
    expect(guarded.parameters.required).toContain('confirm');
    expect(guarded.parameters.properties['dryRun']).toBeDefined();
  });
});

describe('Skill Parsers', () => {
  it('parses Python functions into SkillIR', () => {
    const pyCode = `
"""Database maintenance tools"""

def purge_cache(prefix: str, max_items: int = 100):
    """Purge stale cache keys."""
    pass

def get_stats():
    """Retrieve system stats."""
    pass
`;

    const skill = parsePythonScript(pyCode, 'cache-tools.py');
    expect(skill.name).toBe('cache-tools');
    expect(skill.tools.length).toBe(2);

    const purgeTool = skill.tools.find((t) => t.name === 'purge_cache');
    expect(purgeTool).toBeDefined();
    expect(purgeTool?.parameters.properties['prefix'].type).toBe('string');
    expect(purgeTool?.parameters.properties['max_items'].type).toBe('integer');
    expect(purgeTool?.parameters.properties['max_items'].default).toBe(100);
    expect(purgeTool?.riskLevel).toBe('destructive_write');
    expect(purgeTool?.parameters.required).toContain('confirm');
  });

  it('parses TypeScript functions into SkillIR', () => {
    const tsCode = `
/**
 * Remove inactive subscribers from mailing list.
 * @param listId Unique mailing list identifier
 * @param days Inactive threshold in days
 */
export async function deleteInactiveUsers(listId: string, days: number = 90): Promise<void> {
  // implementation
}
`;

    const skill = parseTypeScriptScript(tsCode, 'mailer.ts');
    expect(skill.name).toBe('mailer');
    expect(skill.tools.length).toBe(1);

    const tool = skill.tools[0];
    expect(tool.name).toBe('deleteInactiveUsers');
    expect(tool.description).toContain('Remove inactive subscribers');
    expect(tool.parameters.properties['listId'].type).toBe('string');
    expect(tool.parameters.properties['days'].type).toBe('number');
    expect(tool.riskLevel).toBe('destructive_write');
  });

  it('synthesizes SkillIR from natural language intent', () => {
    const intent = 'Export Postgres records to CSV given connection_string and table_name';
    const skill = parseNaturalLanguageIntent(intent, 'db-exporter');

    expect(skill.name).toBe('db-exporter');
    expect(skill.tools.length).toBe(1);
    expect(skill.tools[0].parameters.properties['connection_string']).toBeDefined();
    expect(skill.tools[0].parameters.properties['table_name']).toBeDefined();
  });
});

describe('Skill Multi-Target Compiler', () => {
  it('generates Antigravity, MCP, Cursor, and OpenAI targets', async () => {
    const intent = 'Query AWS DynamoDB table given table_name and key';
    const result = await compileSkill(intent, { target: 'all', writeFiles: false });

    expect(result.skill.name).toBe('query-aws-dynamodb-table-given');
    expect(result.files.length).toBeGreaterThanOrEqual(6);

    const fileNames = result.files.map((f) => f.relativePath);
    expect(fileNames).toContain('SKILL.md');
    expect(fileNames).toContain('scripts/run.js');
    expect(fileNames).toContain('mcp-server.js');
    expect(fileNames).toContain('mcp-config.json');
    expect(fileNames).toContain('.cursorrules');
    expect(fileNames).toContain('.windsurfrules');
    expect(fileNames).toContain('openai-tools.json');
    expect(fileNames).toContain('anthropic-tools.json');
    expect(fileNames).toContain('opencode.json');
    expect(fileNames).toContain('opencode-tools.json');
    expect(fileNames).toContain('hermes-tools.json');
    expect(fileNames).toContain('hermes-prompt.md');
    expect(fileNames).toContain('skill.yaml');
    expect(fileNames).toContain('goose-extension.yaml');
    expect(fileNames).toContain('.goosehints');
    expect(fileNames).toContain('.claude/mcp.json');
    expect(fileNames).toContain('CLAUDE.md');
    expect(fileNames).toContain('.aider.conf.yml');
    expect(fileNames).toContain('.aiderignore');
    expect(fileNames).toContain('continue-config.json');

    // Verify MCP Server content has valid JSON-RPC structure
    const mcpServer = result.files.find((f) => f.relativePath === 'mcp-server.js');
    expect(mcpServer?.content).toContain('readline');
    expect(mcpServer?.content).toContain('tools/list');
    expect(mcpServer?.content).toContain('tools/call');
    expect(mcpServer?.content).toContain('__vibeAssertSafe');

    // Verify Antigravity manifest
    const skillMd = result.files.find((f) => f.relativePath === 'SKILL.md');
    expect(skillMd?.content).toContain('---');
    expect(skillMd?.content).toContain('## Security & Guardrail Policy');

    // Verify OpenCode configuration
    const opencodeCfg = result.files.find((f) => f.relativePath === 'opencode.json');
    expect(opencodeCfg?.content).toContain('https://opencode.ai/config.json');
    expect(opencodeCfg?.content).toContain('mcp');

    // Verify Hermes prompt with <tools> XML tags
    const hermesPrompt = result.files.find((f) => f.relativePath === 'hermes-prompt.md');
    expect(hermesPrompt?.content).toContain('<tools>');
    expect(hermesPrompt?.content).toContain('<tool_call>');

    // Verify Goose extension
    const gooseExt = result.files.find((f) => f.relativePath === 'goose-extension.yaml');
    expect(gooseExt?.content).toContain('extensions:');
    expect(gooseExt?.content).toContain('stdio');

    // Verify Claude Code configuration
    const claudeMcp = result.files.find((f) => f.relativePath === '.claude/mcp.json');
    expect(claudeMcp?.content).toContain('mcpServers');
  });

  it('compiles specifically to OpenCode target', async () => {
    const intent = 'Ping remote health endpoint url';
    const result = await compileSkill(intent, { target: 'opencode', writeFiles: false });
    const fileNames = result.files.map((f) => f.relativePath);
    expect(fileNames).toContain('opencode.json');
    expect(fileNames).toContain('opencode-tools.json');
  });

  it('compiles specifically to Nous Hermes target', async () => {
    const intent = 'Flush Redis cache keys pattern';
    const result = await compileSkill(intent, { target: 'hermes', writeFiles: false });
    const fileNames = result.files.map((f) => f.relativePath);
    expect(fileNames).toContain('hermes-tools.json');
    expect(fileNames).toContain('hermes-prompt.md');
    expect(fileNames).toContain('skill.yaml');
  });

  it('compiles specifically to Goose target', async () => {
    const intent = 'Analyze PostgreSQL connection pool status';
    const result = await compileSkill(intent, { target: 'goose', writeFiles: false });
    const fileNames = result.files.map((f) => f.relativePath);
    expect(fileNames).toContain('goose-extension.yaml');
    expect(fileNames).toContain('.goosehints');
  });

  it('compiles specifically to Claude Code target', async () => {
    const intent = 'Trigger Docker container rebuild';
    const result = await compileSkill(intent, { target: 'claudecode', writeFiles: false });
    const fileNames = result.files.map((f) => f.relativePath);
    expect(fileNames).toContain('.claude/mcp.json');
    expect(fileNames).toContain('CLAUDE.md');
  });

  it('compiles specifically to OpenHands target', async () => {
    const intent = 'Run Prisma database migrations';
    const result = await compileSkill(intent, { target: 'openhands', writeFiles: false });
    const file = result.files.find((f) => f.relativePath.startsWith('.openhands/microagents/'));
    expect(file).toBeDefined();
    expect(file?.content).toContain('CodeActAgent');
  });

  it('compiles specifically to Aider and Continue targets', async () => {
    const intent = 'Format TypeScript codebase';
    const aiderRes = await compileSkill(intent, { target: 'aider', writeFiles: false });
    expect(aiderRes.files.map((f) => f.relativePath)).toContain('.aider.conf.yml');

    const continueRes = await compileSkill(intent, { target: 'continue', writeFiles: false });
    expect(continueRes.files.map((f) => f.relativePath)).toContain('continue-config.json');
  });
});

describe('OpenAPI to Skill Ingestion', () => {
  it('parses OpenAPI endpoints into guarded AI tools', async () => {
    const { parseOpenAPISpec } = await import('../src/skills/openapi.js');

    const sampleSpec = JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Payment API', version: '1.0.0' },
      paths: {
        '/charges': {
          get: {
            summary: 'List charges',
            parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
          },
          post: {
            summary: 'Create a charge',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['amount'],
                    properties: {
                      amount: { type: 'integer', description: 'Amount in cents' },
                      currency: { type: 'string', default: 'usd' },
                    },
                  },
                },
              },
            },
          },
        },
        '/charges/{id}': {
          delete: {
            summary: 'Cancel a charge',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
        },
      },
    });

    const skill = await parseOpenAPISpec(sampleSpec);
    expect(skill.name).toBe('payment-api');
    expect(skill.tools.length).toBe(3);

    const deleteTool = skill.tools.find((t) => t.name.startsWith('delete'));
    expect(deleteTool).toBeDefined();
    expect(deleteTool?.riskLevel).toBe('destructive_write');
    expect(deleteTool?.parameters.required).toContain('confirm');

    const postTool = skill.tools.find((t) => t.name.startsWith('post'));
    expect(postTool?.parameters.properties['amount']).toBeDefined();
    expect(postTool?.parameters.properties['amount'].type).toBe('integer');
  });
});

describe('Skill Security & Quality Auditor', () => {
  it('computes quality score and flags vulnerabilities', async () => {
    const { auditSkill } = await import('../src/skills/auditor.js');

    const sampleManifest = `---
name: vulnerable-skill
version: 1.0.0
description: Sample test
tools:
  - id: delete_all
    name: delete_all
    description: Wipe records
    riskLevel: destructive_write
    parameters:
      type: object
      properties:
        target: { type: string }
      required: [target]
    execution:
      type: node
      code: "const key = 'sk-123456789012345678901234';"
    guardrails: {}
---
# Vulnerable
`;

    const report = await auditSkill(sampleManifest);
    expect(report.score).toBeLessThan(70);
    expect(report.grade).not.toBe('A+');
    expect(report.findings.some((f) => f.id.includes('missing-confirm'))).toBe(true);
    expect(report.findings.some((f) => f.id.includes('hardcoded-secret'))).toBe(true);
  });
});
