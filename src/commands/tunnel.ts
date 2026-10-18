import os from 'os';
import path from 'path';
import net from 'net';
import http from 'http';
import https from 'https';
import fs from 'fs-extra';
import { spawn, ChildProcess } from 'child_process';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import qrcode from 'qrcode-terminal';
import { inspectProject } from '../inspector.js';

export interface TunnelOptions {
  port?: number;
  stripe?: boolean;
  qr?: boolean;
}

/**
 * Checks if a TCP port is currently accepting connections on localhost.
 */
export function isPortListening(port: number, host = '127.0.0.1', timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isConnected = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      isConnected = true;
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Automatically discovers the currently active local development port.
 */
export async function detectActivePort(fallbackPort = 3000): Promise<{ port: number; source: string }> {
  // Common development server ports to probe
  const candidatePorts = [3000, 5173, 4000, 8080, 8000, 5000, 3001, 4200];

  for (const port of candidatePorts) {
    if (await isPortListening(port)) {
      return { port, source: `Live service detected on port ${port}` };
    }
  }

  // Check package.json scripts or defaults
  const cwd = process.cwd();
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readJsonSync(pkgPath);
      if (pkg.scripts?.dev?.includes('5173')) return { port: 5173, source: 'package.json dev script (Vite)' };
      if (pkg.scripts?.dev?.includes('4000')) return { port: 4000, source: 'package.json dev script (Mock API)' };
      if (pkg.scripts?.dev?.includes('8080')) return { port: 8080, source: 'package.json dev script' };
    } catch {
      // ignore
    }
  }

  return { port: fallbackPort, source: `Default port ${fallbackPort}` };
}

/**
 * Locates or returns the path to a cloudflared executable.
 */
export function resolveCloudflaredPath(): string | null {
  const isWin = os.platform() === 'win32';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';

  // 1. Check user cache directory: ~/.vibe/bin/cloudflared(.exe)
  const userBin = path.join(os.homedir(), '.vibe', 'bin', binName);
  if (fs.existsSync(userBin)) {
    return userBin;
  }

  // 2. Check local workspace directory: .vibe/bin/
  const localBin = path.join(process.cwd(), '.vibe', 'bin', binName);
  if (fs.existsSync(localBin)) {
    return localBin;
  }

  return null;
}

/**
 * Downloads the official standalone cloudflared binary to ~/.vibe/bin/
 */
export async function downloadCloudflared(targetDir: string): Promise<string> {
  const isWin = os.platform() === 'win32';
  const isMac = os.platform() === 'darwin';
  const binName = isWin ? 'cloudflared.exe' : 'cloudflared';
  const targetPath = path.join(targetDir, binName);

  fs.ensureDirSync(targetDir);

  let downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
  if (isWin) {
    downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
  } else if (isMac) {
    downloadUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz';
  }

  return new Promise((resolve, reject) => {
    function fetchUrl(url: string) {
      https.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchUrl(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download cloudflared: HTTP ${res.statusCode}`));
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          if (!isWin) {
            fs.chmodSync(targetPath, 0o755);
          }
          resolve(targetPath);
        });

        fileStream.on('error', (err) => {
          fs.removeSync(targetPath);
          reject(err);
        });
      }).on('error', reject);
    }

    fetchUrl(downloadUrl);
  });
}

/**
 * Starts a Cloudflare Quick Tunnel using untun or local cloudflared binary.
 */
export async function spawnTunnelProcess(
  port: number
): Promise<{ process: ChildProcess; urlPromise: Promise<string> }> {
  let binPath = resolveCloudflaredPath();

  // Try checking if cloudflared is on system PATH
  let usePath = false;
  if (!binPath) {
    try {
      const checkCmd = os.platform() === 'win32' ? 'where' : 'which';
      const child = spawn(checkCmd, ['cloudflared'], { shell: true });
      await new Promise<void>((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            usePath = true;
            resolve();
          } else {
            reject();
          }
        });
      });
    } catch {
      usePath = false;
    }
  }

  let child: ChildProcess;

  if (usePath || binPath) {
    const cmd = binPath || 'cloudflared';
    child = spawn(cmd, ['tunnel', '--url', `http://localhost:${port}`], {
      shell: false,
    });
  } else {
    // Spawn via npx untun
    const npxCmd = os.platform() === 'win32' ? 'npx.cmd' : 'npx';
    child = spawn(npxCmd, ['--yes', 'untun', 'tunnel', `http://localhost:${port}`], {
      shell: true,
    });
  }

  const urlPromise = new Promise<string>((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Timed out waiting for tunnel URL from Cloudflare (15s).'));
      }
    }, 18000);

    const onData = (data: Buffer | string) => {
      const text = data.toString();
      // Match trycloudflare.com URL or localtunnel URL
      const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.(?:trycloudflare\.com|loca\.lt)/i);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(match[0]);
      }
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Tunnel process exited prematurely with code ${code}`));
      }
    });
  });

  return { process: child, urlPromise };
}

/**
 * vibe tunnel [port]
 */
export async function tunnelCommand(
  portInput?: string,
  options: TunnelOptions = {}
): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' vibe tunnel ')) + ' ' + pc.bold('Instant Zero-Config Public Bridge & Webhook Relay'));

  let targetPort: number;

  if (portInput && !isNaN(parseInt(portInput, 10))) {
    targetPort = parseInt(portInput, 10);
  } else if (options.port) {
    targetPort = options.port;
  } else {
    const s = p.spinner();
    s.start('Probing local development ports...');
    const detected = await detectActivePort(3000);
    s.stop(pc.green(detected.source));

    const confirmed = await p.confirm({
      message: `Connect tunnel to ${pc.cyan(`http://localhost:${detected.port}`)}?`,
      initialValue: true,
    });

    if (p.isCancel(confirmed)) return;

    if (!confirmed) {
      const customPort = await p.text({
        message: 'Enter local port to forward:',
        placeholder: '3000',
        validate: (val) => (!val || isNaN(parseInt(val, 10)) ? 'Must be a valid port number' : undefined),
      });

      if (p.isCancel(customPort)) return;
      targetPort = parseInt(customPort, 10);
    } else {
      targetPort = detected.port;
    }
  }

  // Check if anything is listening on the port
  const isListening = await isPortListening(targetPort);
  if (!isListening) {
    p.log.warn(
      `No active process detected on port ${targetPort}. Tunnels will forward, but ensure your dev server or mock API is running!`
    );
  }

  const s = p.spinner();
  s.start(`Opening ephemeral Cloudflare Quick Tunnel to port ${targetPort}...`);

  let tunnelProc: ChildProcess;
  let publicUrl = '';

  try {
    const { process: child, urlPromise } = await spawnTunnelProcess(targetPort);
    tunnelProc = child;

    publicUrl = await urlPromise;
    s.stop(pc.green('✔ Tunnel established successfully!'));
  } catch (err: any) {
    s.stop(pc.yellow('Could not start quick tunnel automatically. Attempting standalone binary download...'));

    const binDir = path.join(os.homedir(), '.vibe', 'bin');
    try {
      const s2 = p.spinner();
      s2.start('Downloading standalone cloudflared binary to ~/.vibe/bin/...');
      await downloadCloudflared(binDir);
      s2.stop(pc.green('Binary ready! Spawning tunnel...'));

      const { process: child, urlPromise } = await spawnTunnelProcess(targetPort);
      tunnelProc = child;
      publicUrl = await urlPromise;
    } catch (err2: any) {
      p.log.error(`Failed to launch tunnel: ${err2.message || err.message}`);
      p.outro(pc.red('Tunnel aborted.'));
      return;
    }
  }

  // Detect Stripe configuration
  const cwd = process.cwd();
  const meta = await inspectProject(cwd);
  const pkgPath = path.join(cwd, 'package.json');
  let hasStripe = options.stripe;

  if (!hasStripe && fs.existsSync(pkgPath)) {
    try {
      const pkg = fs.readJsonSync(pkgPath);
      const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (all['stripe'] || all['@stripe/stripe-js']) {
        hasStripe = true;
      }
    } catch {
      // ignore
    }
  }

  const stripeWebhookUrl = `${publicUrl}/api/webhooks/stripe`;

  let details =
    `Public URL:     ${pc.bold(pc.green(publicUrl))}\n` +
    `Forwarding to:  ${pc.cyan(`http://localhost:${targetPort}`)}\n` +
    `Protocol:       ${pc.dim('TLS Encrypted (Cloudflare Quick Tunnel)')}\n` +
    `Zero Config:    ${pc.dim('No account, no API key, zero cost')}\n`;

  if (hasStripe) {
    details +=
      `\n${pc.bold(pc.yellow('Stripe Webhook Relay:'))}\n` +
      `  • Endpoint:   ${pc.bold(pc.white(stripeWebhookUrl))}\n` +
      `  • Dashboard:  ${pc.dim('Add endpoint in Stripe Dashboard -> Developers -> Webhooks')}\n` +
      `  • Or CLI:     ${pc.dim(`stripe listen --forward-to ${publicUrl}/api/webhooks/stripe`)}\n`;
  }

  p.note(details, 'Live Public Tunnel Active');

  // Terminal QR Code for 1-second mobile testing!
  if (options.qr !== false) {
    console.log(pc.bold('  Mobile Test QR Code (Scan with phone camera):'));
    qrcode.generate(publicUrl, { small: true }, (qr) => {
      const indented = qr
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n');
      console.log(indented);
    });
  }

  p.log.info(pc.dim('Streaming tunnel traffic. Press Ctrl+C to close tunnel.'));

  // Handle clean process shutdown
  const cleanup = () => {
    try {
      if (tunnelProc && !tunnelProc.killed) {
        tunnelProc.kill();
      }
    } catch {
      // ignore
    }
    console.log('\n' + pc.cyan('Tunnel closed. Goodbye!'));
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process alive while tunnel runs
  await new Promise<void>(() => {});
}
