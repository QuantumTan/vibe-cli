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
  });
});
