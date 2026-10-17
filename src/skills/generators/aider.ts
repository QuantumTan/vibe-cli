import { SkillIR, GeneratedFile } from '../types.js';

/**
 * Generates Aider pair programming harness configuration files (.aider.conf.yml and .aiderignore).
 */
export function generateAiderTarget(skill: SkillIR): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const configContent = `# Aider configuration for ${skill.name}
auto-commits: false
attribute-author: true
attribute-committer: false
lint-cmd: "npm test"
test-cmd: "npm test"
`;

  files.push({
    relativePath: '.aider.conf.yml',
    content: configContent,
    description: 'Aider terminal harness configuration',
  });

  const ignoreContent = `# Aider ignore rules for ${skill.name}
.vault/Checkpoints/
.vault/History/
node_modules/
dist/
`;

  files.push({
    relativePath: '.aiderignore',
    content: ignoreContent,
    description: 'Aider repo file ignore rules',
  });

  return files;
}
