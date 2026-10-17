export interface RegisteredProject {
  name: string;
  path: string;
  vault: string;
  stack: string[];
  category: string;
  verifyCmd?: string;
  devCmd?: string;
  repoUrl?: string;
  summary?: string;
  showcase: boolean;
  linkedAt: string;
}

export interface VibeConfig {
  defaultVault: string;
  vaultsRoot: string;
  projectsRoot: string;
  portfolioRepoPath: string;
  vaults: Record<string, string>;
  registeredProjects: RegisteredProject[];
}

export interface ProjectMetadata {
  name: string;
  projectPath: string;
  stack: string[];
  category: string;
  verifyCmd: string;
  devCmd?: string;
  repoUrl?: string;
  summary: string;
  platformNotes?: Record<string, string>;
}
