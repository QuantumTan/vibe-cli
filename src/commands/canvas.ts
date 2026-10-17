import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { loadConfig } from '../config.js';
import { inspectProject } from '../inspector.js';

export interface CanvasNode {
  id: string;
  type: 'text' | 'file' | 'link' | 'group';
  text?: string;
  file?: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // "1" = red, "2" = orange, "3" = yellow, "4" = green, "5" = cyan, "6" = purple
  label?: string;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toNode: string;
  toSide: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  color?: string;
}

export interface ObsidianCanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

/**
 * Builds Obsidian Canvas JSON for the project ecosystem.
 */
export async function buildProjectCanvas(
  cwd: string,
  projectName: string,
  vaultProjectRel: string
): Promise<ObsidianCanvasData> {
  const meta = await inspectProject(cwd);
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  // Node 1: Project Master Hub (Center-Left)
  nodes.push({
    id: 'node_hub',
    type: 'text',
    text: `## ⚡ ${projectName}\n\n` +
      `> **Stack**: ${meta.stack.join(', ')}\n` +
      `> **Dev Command**: \`${meta.devCmd}\`\n` +
      `> **Verify Command**: \`${meta.verifyCmd}\`\n\n` +
      `*Live AI Orchestration Hub linked with Obsidian.*`,
    x: 0,
    y: 0,
    width: 360,
    height: 240,
    color: '5', // Cyan
  });

  // Node 2: Active Context & Tasks (Top-Right)
  nodes.push({
    id: 'node_context',
    type: 'text',
    text: `### 📋 Active Sprint Tasks & Context\n\n` +
      `Embedded from \`_Context.md\`:\n` +
      `- [ ] Complete core feature implementation\n` +
      `- [ ] Run \`vibe check\` verification suite\n` +
      `- [ ] Run \`vibe ship\` commercial pre-flight audit`,
    x: 440,
    y: -150,
    width: 380,
    height: 220,
    color: '4', // Green
  });

  // Node 3: Architecture & Module Topology (Middle-Right)
  nodes.push({
    id: 'node_arch',
    type: 'text',
    text: `### 🗺️ Architecture & Module Map\n\n` +
      `Visual topology generated via \`vibe map\`.\n\n` +
      `- [[Codebase-Map|Open Interactive Codebase Map]]\n` +
      `- [[00-Symbol-Index|Open Symbol Index]]`,
    x: 440,
    y: 120,
    width: 380,
    height: 180,
    color: '6', // Purple
  });

  // Node 4: Database & Schema (Bottom-Right)
  nodes.push({
    id: 'node_db',
    type: 'text',
    text: `### 🗄️ Database Schema & ER Diagram\n\n` +
      `Generated via \`vibe db\`.\n\n` +
      `- [[Database-Schema|Open Living ER Diagram]]\n` +
      `- Grounded schemas with zero column hallucination.`,
    x: 440,
    y: 350,
    width: 380,
    height: 180,
    color: '2', // Orange
  });

  // Node 5: Memory Bank Lessons (Bottom-Left)
  nodes.push({
    id: 'node_memory',
    type: 'text',
    text: `### 🧠 Memory Bank & Lessons\n\n` +
      `Auto-synced via \`vibe snap\` and \`vibe wrapup\`.\n\n` +
      `- [[Memory-Bank/Lessons-and-Gotchas|Lessons & Gotchas]]\n` +
      `- [[Memory-Bank/Archive|Completed Tasks Archive]]`,
    x: 0,
    y: 300,
    width: 360,
    height: 200,
    color: '3', // Yellow
  });

  // Connect Edges
  edges.push({
    id: 'edge_hub_to_context',
    fromNode: 'node_hub',
    fromSide: 'right',
    toNode: 'node_context',
    toSide: 'left',
    label: 'executes',
  });

  edges.push({
    id: 'edge_hub_to_arch',
    fromNode: 'node_hub',
    fromSide: 'right',
    toNode: 'node_arch',
    toSide: 'left',
    label: 'structured by',
  });

  edges.push({
    id: 'edge_hub_to_db',
    fromNode: 'node_hub',
    fromSide: 'right',
    toNode: 'node_db',
    toSide: 'left',
    label: 'persists to',
  });

  edges.push({
    id: 'edge_hub_to_memory',
    fromNode: 'node_hub',
    fromSide: 'bottom',
    toNode: 'node_memory',
    toSide: 'top',
    label: 'remembers',
  });

  return { nodes, edges };
}

/**
 * vibe canvas [targetDir]
 */
export async function canvasCommand(targetDirInput?: string): Promise<void> {
  const cwd = targetDirInput ? path.resolve(targetDirInput) : process.cwd();
  const projectName = path.basename(cwd);
  const config = loadConfig();

  p.intro(pc.bgMagenta(pc.black(' vibe canvas ')) + ' ' + pc.bold('Native Obsidian Visual Canvas Generator'));

  const s = p.spinner();
  s.start(`Generating interactive visual canvas board for ${projectName}...`);

  const vaultProjectRel = `02-Projects/${projectName}`;
  const canvasData = await buildProjectCanvas(cwd, projectName, vaultProjectRel);

  // Determine save location: in project .vault/ and default Obsidian vault if wired
  const savedLocations: string[] = [];

  const localVaultDir = path.join(cwd, '.vault');
  if (await fs.pathExists(localVaultDir)) {
    const localCanvas = path.join(localVaultDir, 'Project-Canvas.canvas');
    await fs.writeJSON(localCanvas, canvasData, { spaces: 2 });
    savedLocations.push(path.relative(cwd, localCanvas).replace(/\\/g, '/'));
  }

  // Also write to active default Obsidian vault if configured
  if (config.defaultVault && config.vaults[config.defaultVault]) {
    const defaultVaultPath = config.vaults[config.defaultVault];
    const projectInVault = path.join(defaultVaultPath, '02-Projects', projectName);
    if (await fs.pathExists(projectInVault)) {
      const vaultCanvas = path.join(projectInVault, 'Project-Canvas.canvas');
      await fs.writeJSON(vaultCanvas, canvasData, { spaces: 2 });
      savedLocations.push(vaultCanvas);
    }
  }

  s.stop(pc.green(`Visual Canvas generated with ${canvasData.nodes.length} cards and ${canvasData.edges.length} connections!`));

  p.note(
    `Cards Created:   ${pc.bold(pc.cyan(canvasData.nodes.length.toString()))} visual nodes\n` +
      `Connections:     ${pc.bold(pc.green(canvasData.edges.length.toString()))} directional edges\n` +
      `Canvas Files:    \n` +
      savedLocations.map((f) => `  ✔ ${pc.white(f)}`).join('\n') +
      `\n\nOpen Obsidian and click on \`Project-Canvas.canvas\` to explore your interactive whiteboard!`,
    'Obsidian Canvas Ready'
  );

  p.outro('Interactive whiteboard active in Obsidian! Beautiful 2D visual layout ready.');
}
