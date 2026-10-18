import { describe, it, expect, afterEach } from 'vitest';
import http from 'http';
import {
  isPortListening,
  detectActivePort,
  resolveCloudflaredPath,
} from '../src/commands/tunnel.js';

describe('Vibe Tunnel (Instant Public Bridge & Webhook Relay)', () => {
  let server: http.Server | null = null;
  const testPort = 59123;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      });
      server = null;
    }
  });

  it('correctly detects a closed port', async () => {
    const isListening = await isPortListening(testPort);
    expect(isListening).toBe(false);
  });

  it('correctly detects an actively listening server port', async () => {
    await new Promise<void>((resolve) => {
      server = http.createServer((_, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      server.listen(testPort, '127.0.0.1', () => resolve());
    });

    const isListening = await isPortListening(testPort);
    expect(isListening).toBe(true);
  });

  it('detectActivePort falls back cleanly when no candidate ports are listening', async () => {
    const res = await detectActivePort(3999);
    expect(res.port).toBeDefined();
    expect(typeof res.port).toBe('number');
  });

  it('resolveCloudflaredPath runs safely without throwing', () => {
    const pathResult = resolveCloudflaredPath();
    expect(pathResult === null || typeof pathResult === 'string').toBe(true);
  });
});
