import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'route' | 'const';
  file: string;
  line: number;
}

export interface ApiRoute {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  path: string;
  handler: string;
  file: string;
}

export interface ModuleNode {
  file: string;
  symbols: CodeSymbol[];
  dependencies: string[];
}

export interface CodebaseMap {
  totalFiles: number;
  totalSymbols: number;
  modules: ModuleNode[];
  routes: ApiRoute[];
  mermaidGraph: string;
}

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.vault',
  '.vault-global',
  'vendor',
  'bin',
  'obj',
  '.turbo',
]);

const SUPPORTED_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.dart',
  '.cs',
  '.php',
  '.go',
]);

/**
 * Scans directories recursively for code files.
 */
export async function collectSourceFiles(dir: string, baseDir = dir): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        const nested = await collectSourceFiles(path.join(dir, entry.name), baseDir);
        results.push(...nested);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTS.has(ext) && !entry.name.endsWith('.d.ts')) {
        results.push(path.relative(baseDir, path.join(dir, entry.name)).replace(/\\/g, '/'));
      }
    }
  }

  return results;
}

/**
 * Extracts symbols, dependencies, and API routes from source code.
 */
export function analyzeSourceFile(relPath: string, content: string): ModuleNode {
  const symbols: CodeSymbol[] = [];
  const dependencies: string[] = [];
  const lines = content.split('\n');

  // Regex patterns
  const fnExportRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/;
  const arrowExportRegex = /export\s+const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\(/;
  const classExportRegex = /export\s+(?:abstract\s+)?class\s+([a-zA-Z0-9_$]+)/;
  const interfaceExportRegex = /export\s+interface\s+([a-zA-Z0-9_$]+)/;
  const typeExportRegex = /export\s+type\s+([a-zA-Z0-9_$]+)/;
  const pyFnRegex = /^def\s+([a-zA-Z0-9_]+)\s*\(/;
  const pyClassRegex = /^class\s+([a-zA-Z0-9_]+)/;
  const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // TypeScript / JS exports
    let match = line.match(fnExportRegex);
    if (match) symbols.push({ name: match[1], kind: 'function', file: relPath, line: lineNum });

    match = line.match(arrowExportRegex);
    if (match) symbols.push({ name: match[1], kind: 'function', file: relPath, line: lineNum });

    match = line.match(classExportRegex);
    if (match) symbols.push({ name: match[1], kind: 'class', file: relPath, line: lineNum });

    match = line.match(interfaceExportRegex);
    if (match) symbols.push({ name: match[1], kind: 'interface', file: relPath, line: lineNum });

    match = line.match(typeExportRegex);
    if (match) symbols.push({ name: match[1], kind: 'type', file: relPath, line: lineNum });

    // Python definitions
    match = line.match(pyFnRegex);
    if (match) symbols.push({ name: match[1], kind: 'function', file: relPath, line: lineNum });

    match = line.match(pyClassRegex);
    if (match) symbols.push({ name: match[1], kind: 'class', file: relPath, line: lineNum });
  });

  // Extract internal relative dependencies
  let impMatch: RegExpExecArray | null;
  while ((impMatch = importRegex.exec(content)) !== null) {
    const impPath = impMatch[1] || impMatch[2];
    if (impPath && impPath.startsWith('.')) {
      // Normalize relative to current file's directory
      const resolved = path.normalize(path.join(path.dirname(relPath), impPath)).replace(/\\/g, '/');
      if (!dependencies.includes(resolved)) {
        dependencies.push(resolved);
      }
    }
  }

  return { file: relPath, symbols, dependencies };
}

/**
 * Detects API routes from source files (Express, Next.js, FastAPI, Flask, Laravel).
 */
export function extractApiRoutes(relPath: string, content: string): ApiRoute[] {
  const routes: ApiRoute[] = [];

  // Express style: app.get('/api/users', ...)
  const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = expressRegex.exec(content)) !== null) {
    routes.push({
      method: m[1].toUpperCase() as any,
      path: m[2],
      handler: `${relPath}:${m[1]}`,
      file: relPath,
    });
  }

  // Next.js App Router: app/api/.../route.ts
  if (relPath.includes('api/') && relPath.includes('route.')) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    for (const method of methods) {
      if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(content)) {
        // Derive path from folder structure: app/api/auth/login/route.ts -> /api/auth/login
        const apiPath = '/' + relPath.replace(/^.*?(api\/)/, '$1').replace(/\/route\.[a-z]+$/, '');
        routes.push({
          method: method as any,
          path: apiPath,
          handler: `${relPath} [${method}]`,
          file: relPath,
        });
      }
    }
  }

  // FastAPI / Flask style: @app.get("/items") or @router.post("/items")
  const pyRouteRegex = /@(?:app|router)\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((m = pyRouteRegex.exec(content)) !== null) {
    routes.push({
      method: m[1].toUpperCase() as any,
      path: m[2],
      handler: `${relPath}:${m[1]}`,
      file: relPath,
    });
  }

  return routes;
}

/**
 * Builds the complete Codebase Topology Map.
 */
export async function buildCodebaseMap(cwd: string): Promise<CodebaseMap> {
  const files = await collectSourceFiles(cwd);
  const modules: ModuleNode[] = [];
  const allRoutes: ApiRoute[] = [];

  for (const relFile of files) {
    const absPath = path.join(cwd, relFile);
    try {
      const content = await fs.readFile(absPath, 'utf8');
      const moduleNode = analyzeSourceFile(relFile, content);
      modules.push(moduleNode);

      const routes = extractApiRoutes(relFile, content);
      allRoutes.push(...routes);
    } catch {
      // Skip unreadable files
    }
  }

  const totalSymbols = modules.reduce((sum, m) => sum + m.symbols.length, 0);

  // Generate Mermaid diagram showing module relationships (capped at 40 edges to keep clean)
  const mermaidLines = ['flowchart TD'];
  const nodesAdded = new Set<string>();
  let edgeCount = 0;

  for (const mod of modules) {
    const modId = mod.file.replace(/[^a-zA-Z0-9]/g, '_');
    if (!nodesAdded.has(modId)) {
      mermaidLines.push(`  ${modId}["${path.basename(mod.file)}"]`);
      nodesAdded.add(modId);
    }

    for (const dep of mod.dependencies) {
      if (edgeCount >= 40) break;
      const targetMod = modules.find((m) => m.file.startsWith(dep) || dep.startsWith(m.file.replace(/\.[a-z]+$/, '')));
      if (targetMod) {
        const targetId = targetMod.file.replace(/[^a-zA-Z0-9]/g, '_');
        mermaidLines.push(`  ${modId} --> ${targetId}`);
        edgeCount++;
      }
    }
  }

  return {
    totalFiles: files.length,
    totalSymbols,
    modules,
    routes: allRoutes,
    mermaidGraph: mermaidLines.join('\n'),
  };
}

/**
 * Formats codebase map as rich Obsidian Markdown with Wikilinks.
 */
export function formatCodebaseMapMarkdown(projectName: string, map: CodebaseMap): string {
  const dateStr = new Date().toISOString().substring(0, 10);

  const routeRows =
    map.routes.length > 0
      ? map.routes
          .map((r) => `| \`${r.method}\` | \`${r.path}\` | \`[[${r.file}]]\` |`)
          .join('\n')
      : '| *No API routes detected* | | |';

  const symbolRows = map.modules
    .filter((m) => m.symbols.length > 0)
    .slice(0, 50)
    .map((m) => {
      const symList = m.symbols.map((s) => `\`${s.name}\` (${s.kind})`).join(', ');
      return `- **\`[[${m.file}]]\`**: ${symList}`;
    })
    .join('\n');

  return `# Codebase Topology & Architecture Map: ${projectName}

> **Generated**: ${dateStr} • **Files**: ${map.totalFiles} • **Exported Symbols**: ${map.totalSymbols} • **API Endpoints**: ${map.routes.length}

---

## 1. Module Relationship Graph

\`\`\`mermaid
${map.mermaidGraph}
\`\`\`

---

## 2. API Route Catalog

| Method | Endpoint Route | Source Handler |
| :--- | :--- | :--- |
${routeRows}

---

## 3. Exported Symbols & Dependency Catalog

${symbolRows || '*No exported symbols detected.*'}

---
*Auto-generated by \`vibe map\`. Kept in sync with Obsidian Vault Architecture.*
`;
}

/**
 * vibe map [targetDir]
 */
export async function mapCommand(targetDirInput?: string): Promise<void> {
  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);

  p.intro(pc.bgMagenta(pc.black(' vibe map ')) + ' ' + pc.bold('Codebase Topology & AST Grapher'));

  const s = p.spinner();
  s.start(`Scanning ${projectName} AST, exports, imports, and API routes...`);

  const map = await buildCodebaseMap(cwd);

  s.stop(pc.green(`Graph built! (${map.totalFiles} files, ${map.totalSymbols} symbols, ${map.routes.length} routes)`));

  // Write to .vault/Architecture/Codebase-Map.md if vault exists, or ./docs/Codebase-Map.md
  const vaultArchDir = path.join(cwd, '.vault', 'Architecture');
  const targetDir = (await fs.pathExists(path.join(cwd, '.vault'))) ? vaultArchDir : path.join(cwd, 'docs');
  await fs.ensureDir(targetDir);

  const mapFile = path.join(targetDir, 'Codebase-Map.md');
  const markdown = formatCodebaseMapMarkdown(projectName, map);
  await fs.writeFile(mapFile, markdown, 'utf8');

  // Also sync 00-Symbol-Index.md
  const symbolIndexFile = path.join(targetDir, '00-Symbol-Index.md');
  if (await fs.pathExists(symbolIndexFile)) {
    const existingIndex = await fs.readFile(symbolIndexFile, 'utf8');
    if (!existingIndex.includes('Codebase-Map.md')) {
      const appended = existingIndex + `\n- [[Codebase-Map|🗺️ Complete Architecture & Module Topology Graph]]\n`;
      await fs.writeFile(symbolIndexFile, appended, 'utf8');
    }
  }

  p.note(
    `Files Scanned:   ${pc.bold(pc.cyan(map.totalFiles.toString()))}\n` +
      `Exported Symbols: ${pc.bold(pc.green(map.totalSymbols.toString()))}\n` +
      `API Endpoints:   ${pc.bold(pc.yellow(map.routes.length.toString()))}\n` +
      `Saved Map:       ${pc.white(mapFile)}\n\n` +
      `Includes interactive Mermaid graph & Obsidian Wikilinks for graph view!`,
    'Codebase Topology Mapped'
  );

  p.outro('Codebase topology active in Obsidian! AI agents have full structural awareness.');
}
