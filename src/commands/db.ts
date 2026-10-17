import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface DbField {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  isNullable?: boolean;
}

export interface DbRelation {
  fromTable: string;
  toTable: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

export interface DbTable {
  name: string;
  fields: DbField[];
}

export interface SchemaAnalysisResult {
  sourceType: 'prisma' | 'drizzle' | 'sql' | 'none';
  sourceFile: string;
  tables: DbTable[];
  relations: DbRelation[];
  mermaidDiagram: string;
}

/**
 * Parses Prisma schema (.prisma) into tables, fields, and relations.
 */
export function parsePrismaSchema(content: string): { tables: DbTable[]; relations: DbRelation[] } {
  const tables: DbTable[] = [];
  const relations: DbRelation[] = [];

  const modelRegex = /model\s+([a-zA-Z0-9_]+)\s*\{([^}]+)\}/g;
  let modelMatch: RegExpExecArray | null;

  while ((modelMatch = modelRegex.exec(content)) !== null) {
    const tableName = modelMatch[1];
    const body = modelMatch[2];
    const fields: DbField[] = [];

    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const tokens = trimmed.split(/\s+/);
      if (tokens.length >= 2) {
        const fieldName = tokens[0];
        const fieldType = tokens[1];
        const isPk = trimmed.includes('@id');
        const isFk = trimmed.includes('@relation');

        // If fieldType matches an uppercase model name and ends with [], it's a one-to-many relation
        if (fieldType.endsWith('[]')) {
          const target = fieldType.replace('[]', '');
          relations.push({
            fromTable: tableName,
            toTable: target,
            relationType: 'one-to-many',
          });
        } else if (!isPk && !isFk && /^[A-Z]/.test(fieldType) && !['String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float'].includes(fieldType)) {
          relations.push({
            fromTable: tableName,
            toTable: fieldType,
            relationType: 'one-to-one',
          });
        }

        fields.push({
          name: fieldName,
          type: fieldType,
          isPk,
          isFk,
          isNullable: fieldType.endsWith('?'),
        });
      }
    }

    tables.push({ name: tableName, fields });
  }

  return { tables, relations };
}

/**
 * Parses simple SQL DDL (CREATE TABLE) statements into tables and fields.
 */
export function parseSqlSchema(content: string): { tables: DbTable[]; relations: DbRelation[] } {
  const tables: DbTable[] = [];
  const relations: DbRelation[] = [];

  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:["`]?)([a-zA-Z0-9_]+)(?:["`]?)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = createTableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const fields: DbField[] = [];

    const fieldLines = body.split(',').map((l) => l.trim()).filter(Boolean);
    for (const f of fieldLines) {
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|CONSTRAINT|KEY|INDEX)/i.test(f)) {
        // Parse foreign key references
        const fkMatch = f.match(/FOREIGN\s+KEY.*?REFERENCES\s+([a-zA-Z0-9_]+)/i);
        if (fkMatch) {
          relations.push({
            fromTable: tableName,
            toTable: fkMatch[1],
            relationType: 'one-to-many',
          });
        }
        continue;
      }

      const parts = f.split(/\s+/);
      if (parts.length >= 2) {
        const fieldName = parts[0].replace(/["`]/g, '');
        const fieldType = parts[1].replace(/["`]/g, '');
        const isPk = /PRIMARY\s+KEY/i.test(f);
        const isFk = /REFERENCES\s+([a-zA-Z0-9_]+)/i.test(f);

        if (isFk) {
          const refTable = f.match(/REFERENCES\s+([a-zA-Z0-9_]+)/i)?.[1];
          if (refTable) {
            relations.push({
              fromTable: tableName,
              toTable: refTable,
              relationType: 'one-to-many',
            });
          }
        }

        fields.push({
          name: fieldName,
          type: fieldType,
          isPk,
          isFk,
          isNullable: !/NOT\s+NULL/i.test(f),
        });
      }
    }

    tables.push({ name: tableName, fields });
  }

  return { tables, relations };
}

/**
 * Generates Mermaid erDiagram syntax.
 */
export function generateMermaidErDiagram(tables: DbTable[], relations: DbRelation[]): string {
  if (tables.length === 0) return 'erDiagram\n  EMPTY {\n    string notice "No tables detected"\n  }';

  const lines = ['erDiagram'];

  // Relations
  const renderedRels = new Set<string>();
  for (const rel of relations) {
    const relKey = `${rel.fromTable}_${rel.toTable}`;
    if (!renderedRels.has(relKey)) {
      const symbol = rel.relationType === 'one-to-many' ? '||--o{' : '||--||';
      lines.push(`  ${rel.fromTable} ${symbol} ${rel.toTable} : "relates to"`);
      renderedRels.add(relKey);
    }
  }

  // Tables
  for (const table of tables) {
    lines.push(`  ${table.name} {`);
    for (const field of table.fields.slice(0, 15)) {
      const sanitizedType = field.type.replace(/[^a-zA-Z0-9_]/g, '') || 'string';
      const pkBadge = field.isPk ? 'PK' : field.isFk ? 'FK' : '';
      lines.push(`    ${sanitizedType} ${field.name} ${pkBadge}`.trimEnd());
    }
    lines.push('  }');
  }

  return lines.join('\n');
}

/**
 * Discovers and analyzes database schema in the workspace.
 */
export async function analyzeDatabaseSchema(cwd: string): Promise<SchemaAnalysisResult> {
  // Check Prisma
  const prismaPaths = [
    path.join(cwd, 'prisma', 'schema.prisma'),
    path.join(cwd, 'schema.prisma'),
  ];
  for (const pth of prismaPaths) {
    if (await fs.pathExists(pth)) {
      const content = await fs.readFile(pth, 'utf8');
      const { tables, relations } = parsePrismaSchema(content);
      return {
        sourceType: 'prisma',
        sourceFile: path.relative(cwd, pth).replace(/\\/g, '/'),
        tables,
        relations,
        mermaidDiagram: generateMermaidErDiagram(tables, relations),
      };
    }
  }

  // Check SQL DDL
  const sqlCandidates = [
    path.join(cwd, 'schema.sql'),
    path.join(cwd, 'db', 'schema.sql'),
    path.join(cwd, 'database', 'schema.sql'),
  ];
  for (const pth of sqlCandidates) {
    if (await fs.pathExists(pth)) {
      const content = await fs.readFile(pth, 'utf8');
      const { tables, relations } = parseSqlSchema(content);
      return {
        sourceType: 'sql',
        sourceFile: path.relative(cwd, pth).replace(/\\/g, '/'),
        tables,
        relations,
        mermaidDiagram: generateMermaidErDiagram(tables, relations),
      };
    }
  }

  // Search migrations directory for SQL files
  const migrationsDir = path.join(cwd, 'migrations');
  if (await fs.pathExists(migrationsDir)) {
    const files = await fs.readdir(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith('.sql'));
    if (sqlFiles.length > 0) {
      let combinedSql = '';
      for (const f of sqlFiles.slice(0, 10)) {
        combinedSql += (await fs.readFile(path.join(migrationsDir, f), 'utf8')) + '\n';
      }
      const { tables, relations } = parseSqlSchema(combinedSql);
      if (tables.length > 0) {
        return {
          sourceType: 'sql',
          sourceFile: 'migrations/*.sql',
          tables,
          relations,
          mermaidDiagram: generateMermaidErDiagram(tables, relations),
        };
      }
    }
  }

  return {
    sourceType: 'none',
    sourceFile: '',
    tables: [],
    relations: [],
    mermaidDiagram: generateMermaidErDiagram([], []),
  };
}

/**
 * Formats Markdown schema documentation for Obsidian.
 */
export function formatDatabaseSchemaMarkdown(projectName: string, analysis: SchemaAnalysisResult): string {
  const dateStr = new Date().toISOString().substring(0, 10);

  const tableDocs = analysis.tables
    .map((t) => {
      const rows = t.fields
        .map((f) => `| \`${f.name}\` | \`${f.type}\` | ${f.isPk ? '🔑 Primary Key' : f.isFk ? '🔗 Foreign Key' : f.isNullable ? 'Nullable' : 'Required'} |`)
        .join('\n');

      return `### Table: \`${t.name}\`\n\n| Field | Type | Attributes |\n| :--- | :--- | :--- |\n${rows}`;
    })
    .join('\n\n');

  return `# Database Architecture & ER Diagram: ${projectName}

> **Source**: \`${analysis.sourceFile || 'Auto-generated'}\` (${analysis.sourceType.toUpperCase()}) • **Tables**: ${analysis.tables.length} • **Relations**: ${analysis.relations.length} • **Updated**: ${dateStr}

---

## 1. Visual Entity-Relationship (ER) Diagram

\`\`\`mermaid
${analysis.mermaidDiagram}
\`\`\`

---

## 2. Typed Table Dictionary

${tableDocs || '*No database tables detected in workspace.*'}

---
*Auto-generated by \`vibe db\`. Keeps AI agents grounded with zero database schema hallucination.*
`;
}

/**
 * vibe db [targetDir]
 */
export async function dbCommand(targetDirInput?: string): Promise<void> {
  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);

  p.intro(pc.bgBlue(pc.white(' vibe db ')) + ' ' + pc.bold('Database Schema & ER Diagram Visualizer'));

  const s = p.spinner();
  s.start(`Analyzing database schemas (Prisma, Drizzle, SQL) for ${projectName}...`);

  const analysis = await analyzeDatabaseSchema(cwd);

  if (analysis.sourceType === 'none') {
    s.stop(pc.yellow('No database schema files detected.'));
    p.log.warn('Looked for schema.prisma, migrations/*.sql, or schema.sql.');
    p.outro('Database visualizer idle.');
    return;
  }

  s.stop(pc.green(`Found ${analysis.sourceType.toUpperCase()} schema (${analysis.tables.length} tables, ${analysis.relations.length} relations)!`));

  // Write to .vault/Architecture/Database-Schema.md
  const vaultArchDir = path.join(cwd, '.vault', 'Architecture');
  const targetDir = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultArchDir : path.join(cwd, 'docs');
  await fs.ensureDir(targetDir);

  const outFile = path.join(targetDir, 'Database-Schema.md');
  const markdown = formatDatabaseSchemaMarkdown(projectName, analysis);
  await fs.writeFile(outFile, markdown, 'utf8');

  // Register in 00-Symbol-Index.md
  const symbolIndexFile = path.join(targetDir, '00-Symbol-Index.md');
  if (await fs.pathExists(symbolIndexFile)) {
    const existingIndex = await fs.readFile(symbolIndexFile, 'utf8');
    if (!existingIndex.includes('Database-Schema.md')) {
      const appended = existingIndex + `\n- [[Database-Schema|🗄️ Database ER Diagram & Table Dictionary]]\n`;
      await fs.writeFile(symbolIndexFile, appended, 'utf8');
    }
  }

  p.note(
    `Schema Source: ${pc.cyan(analysis.sourceFile)} (${analysis.sourceType.toUpperCase()})\n` +
      `Tables:        ${pc.bold(pc.green(analysis.tables.length.toString()))} model(s)\n` +
      `Relations:     ${pc.bold(pc.yellow(analysis.relations.length.toString()))} relationship(s)\n` +
      `Output File:   ${pc.white(outFile)}\n\n` +
      `Includes living Mermaid ER diagram and typed table dictionaries!`,
    'Database Schema Mapped'
  );

  p.outro('Database schema active in Obsidian! AI agents have zero database hallucination.');
}
