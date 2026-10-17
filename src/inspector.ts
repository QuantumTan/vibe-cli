import fs from 'fs-extra';
import path from 'path';
import type { ProjectMetadata } from './types.js';

export function normalizeGitUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  // Handle SSH: git@github.com:user/repo.git
  if (url.startsWith('git@')) {
    url = url.replace(/^git@([^:]+):/, 'https://$1/');
  }
  // Strip trailing .git
  if (url.endsWith('.git')) {
    url = url.slice(0, -4);
  }
  return url;
}

export function extractGitRemote(projectPath: string): string | undefined {
  const gitConfigPath = path.join(projectPath, '.git', 'config');
  if (!fs.existsSync(gitConfigPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(gitConfigPath, 'utf-8');
    const remoteOriginMatch = content.match(/\[remote\s+"origin"\][^\[]*url\s*=\s*([^\r\n]+)/i);
    if (remoteOriginMatch && remoteOriginMatch[1]) {
      return normalizeGitUrl(remoteOriginMatch[1]);
    }
  } catch {
    // Silently fall back
  }
  return undefined;
}

export function extractReadmeSummary(projectPath: string, fallbackName: string): string {
  const possibleNames = ['README.md', 'readme.md', 'Readme.md', 'README'];
  let readmePath: string | null = null;

  for (const name of possibleNames) {
    const full = path.join(projectPath, name);
    if (fs.existsSync(full)) {
      readmePath = full;
      break;
    }
  }

  if (!readmePath) {
    return `Auto-linked ${fallbackName} project.`;
  }

  try {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip headers, badges, HTML, images
      if (
        !line ||
        line.startsWith('#') ||
        line.startsWith('![') ||
        line.startsWith('[![') ||
        line.startsWith('<') ||
        line.startsWith('```') ||
        line.startsWith('---')
      ) {
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph.join(' '));
          currentParagraph = [];
        }
        continue;
      }

      currentParagraph.push(line);
    }

    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }

    const firstClean = paragraphs.find((p) => p.length > 10);
    if (firstClean) {
      const cleanText = firstClean.replace(/\s+/g, ' ').trim();
      if (cleanText.length > 140) {
        return cleanText.substring(0, 137).trim() + '...';
      }
      return cleanText;
    }
  } catch {
    // Silently fall back
  }

  return `Auto-linked ${fallbackName} project.`;
}

export async function inspectProject(projectPath: string): Promise<ProjectMetadata> {
  const resolvedPath = path.resolve(projectPath);
  const name = path.basename(resolvedPath);

  const stack: string[] = [];
  let category = 'Software Project';
  let verifyCmd = '';
  let devCmd: string | undefined = undefined;
  const platformNotes: Record<string, string> = {};

  const packageJsonPath = path.join(resolvedPath, 'package.json');
  const composerJsonPath = path.join(resolvedPath, 'composer.json');
  const artisanPath = path.join(resolvedPath, 'artisan');
  const pubspecPath = path.join(resolvedPath, 'pubspec.yaml');
  const pyprojectPath = path.join(resolvedPath, 'pyproject.toml');
  const requirementsPath = path.join(resolvedPath, 'requirements.txt');
  const cargoPath = path.join(resolvedPath, 'Cargo.toml');
  const goModPath = path.join(resolvedPath, 'go.mod');

  // 1. Node.js / JavaScript / TypeScript Ecosystem
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = fs.readJsonSync(packageJsonPath);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      if (allDeps['next']) stack.push('Next.js');
      if (allDeps['react'] && !allDeps['next']) stack.push('React');
      if (allDeps['vue']) stack.push('Vue');
      if (allDeps['svelte']) stack.push('Svelte');
      if (allDeps['astro']) stack.push('Astro');
      if (allDeps['nuxt']) stack.push('Nuxt');
      if (allDeps['tailwindcss']) stack.push('Tailwind CSS');
      if (allDeps['vite']) stack.push('Vite');
      if (allDeps['electron']) stack.push('Electron');
      if (allDeps['oxlint']) stack.push('Oxlint');
      if (allDeps['express']) stack.push('Express');
      if (allDeps['fastify']) stack.push('Fastify');
      if (allDeps['@nestjs/core']) stack.push('NestJS');
      if (allDeps['prisma'] || allDeps['@prisma/client']) stack.push('Prisma');
      if (allDeps['drizzle-orm']) stack.push('Drizzle');

      const hasTs =
        allDeps['typescript'] ||
        fs.existsSync(path.join(resolvedPath, 'tsconfig.json'));
      if (hasTs) stack.push('TypeScript');
      else stack.push('JavaScript');

      // Category detection
      if (allDeps['electron']) {
        category = 'Desktop App';
      } else if (allDeps['react-native'] || allDeps['expo']) {
        category = 'Mobile App';
        if (allDeps['expo']) stack.push('Expo');
        else stack.push('React Native');
      } else if (
        allDeps['next'] ||
        allDeps['nuxt'] ||
        allDeps['astro'] ||
        allDeps['react'] ||
        allDeps['vue'] ||
        allDeps['vite']
      ) {
        category = 'Web App';
      } else if (allDeps['express'] || allDeps['fastify'] || allDeps['@nestjs/core']) {
        category = 'Backend / API';
      } else {
        category = 'Web App';
      }

      // Dev command
      if (pkg.scripts?.dev) {
        devCmd = 'npm run dev';
      } else if (pkg.scripts?.start) {
        devCmd = 'npm start';
      }

      // Verify command
      if (pkg.scripts?.build) {
        verifyCmd = 'npm run build';
      } else if (pkg.scripts?.test) {
        verifyCmd = 'npm test';
      } else if (hasTs) {
        verifyCmd = 'npx tsc --noEmit';
      } else {
        verifyCmd = 'npm run build';
      }
    } catch {
      stack.push('Node.js');
      category = 'Web App';
      verifyCmd = 'npm test';
    }
  }

  // 2. PHP / Laravel
  if (fs.existsSync(composerJsonPath) || fs.existsSync(artisanPath)) {
    if (!stack.includes('PHP')) stack.push('PHP');
    if (fs.existsSync(artisanPath) && !stack.includes('Laravel')) {
      stack.push('Laravel');
      stack.push('MySQL');
    }
    category = 'Web App';
    verifyCmd = 'php artisan test';
    devCmd = 'php artisan serve';
  }

  // 3. .NET / C#
  let hasCsprojOrSln = false;
  try {
    const files = fs.readdirSync(resolvedPath);
    const csprojFiles = files.filter((f) => f.endsWith('.csproj'));
    const slnFiles = files.filter((f) => f.endsWith('.sln'));

    if (csprojFiles.length > 0 || slnFiles.length > 0) {
      hasCsprojOrSln = true;
      if (!stack.includes('C#')) stack.push('C#');
      if (!stack.includes('.NET')) stack.push('.NET');
      category = 'Desktop App';
      verifyCmd = 'dotnet build';
      devCmd = 'dotnet watch run';

      // Inspect csproj content for WPF / WinForms / Web
      for (const csproj of csprojFiles) {
        try {
          const content = fs.readFileSync(path.join(resolvedPath, csproj), 'utf-8');
          if (content.includes('<UseWPF>true</UseWPF>')) {
            if (!stack.includes('WPF')) stack.push('WPF');
            category = 'Desktop App';
          }
          if (content.includes('<UseWindowsForms>true</UseWindowsForms>')) {
            if (!stack.includes('WinForms')) stack.push('WinForms');
            category = 'Desktop App';
          }
          if (content.includes('Microsoft.NET.Sdk.Web')) {
            category = 'Web App';
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Flutter / Dart
  if (fs.existsSync(pubspecPath)) {
    if (!stack.includes('Flutter')) stack.push('Flutter');
    if (!stack.includes('Dart')) stack.push('Dart');
    category = 'Mobile App';
    verifyCmd = 'flutter analyze';
    devCmd = 'flutter run';

    // Try extracting bundle ID / package name
    try {
      const pubspecRaw = fs.readFileSync(pubspecPath, 'utf-8');
      const nameMatch = pubspecRaw.match(/^name:\s*([^\r\n]+)/m);
      if (nameMatch && nameMatch[1]) {
        platformNotes['flutterPackage'] = nameMatch[1].trim();
      }
    } catch {
      // ignore
    }
  }

  // 5. Python
  if (fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)) {
    if (!stack.includes('Python')) stack.push('Python');
    if (category === 'Software Project') category = 'Backend / API';
    if (!verifyCmd) verifyCmd = 'pytest';
    if (!devCmd) devCmd = 'python main.py';
  }

  // 6. Rust
  if (fs.existsSync(cargoPath)) {
    if (!stack.includes('Rust')) stack.push('Rust');
    if (category === 'Software Project') category = 'System / CLI';
    if (!verifyCmd) verifyCmd = 'cargo check';
    if (!devCmd) devCmd = 'cargo run';
  }

  // 7. Go
  if (fs.existsSync(goModPath)) {
    if (!stack.includes('Go')) stack.push('Go');
    if (category === 'Software Project') category = 'Backend / CLI';
    if (!verifyCmd) verifyCmd = 'go build';
    if (!devCmd) devCmd = 'go run .';
  }

  // 8. Static Web Fallback
  if (stack.length === 0 && fs.existsSync(path.join(resolvedPath, 'index.html'))) {
    stack.push('HTML', 'CSS', 'JavaScript');
    category = 'Web App';
    if (!verifyCmd) verifyCmd = 'echo "No build step required"';
  }

  // Default fallback if nothing was detected
  if (stack.length === 0) {
    stack.push('General');
    category = 'General Project';
    verifyCmd = 'echo "No verify command configured"';
  }

  const repoUrl = extractGitRemote(resolvedPath);
  const summary = extractReadmeSummary(resolvedPath, name);

  return {
    name,
    projectPath: resolvedPath,
    stack,
    category,
    verifyCmd,
    devCmd,
    repoUrl,
    summary,
    platformNotes: Object.keys(platformNotes).length > 0 ? platformNotes : undefined,
  };
}
