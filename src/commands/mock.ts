import http, { IncomingMessage, ServerResponse, Server } from 'http';
import path from 'path';
import fs from 'fs-extra';
import * as p from '@clack/prompts';
import pc from 'picocolors';

export interface MockServerOptions {
  port?: number;
  delay?: number;
  chaos?: number;
  dataFile?: string;
  silent?: boolean;
}

export interface MockStore {
  [collection: string]: Array<Record<string, any>>;
}

const DEFAULT_STORE: MockStore = {
  users: [
    { id: '1', name: 'Alex Johnson', email: 'alex@example.com', role: 'admin', active: true },
    { id: '2', name: 'Maria Garcia', email: 'maria@example.com', role: 'developer', active: true },
    { id: '3', name: 'David Kim', email: 'david@example.com', role: 'viewer', active: false },
  ],
  products: [
    { id: '1', name: 'Pro Subscription', price: 49, interval: 'month', tier: 'pro' },
    { id: '2', name: 'Enterprise License', price: 149, interval: 'month', tier: 'enterprise' },
  ],
  billing: [
    { id: 'sub_101', userId: '1', status: 'active', plan: 'pro', renewsAt: '2026-11-01' },
    { id: 'sub_102', userId: '2', status: 'active', plan: 'starter', renewsAt: '2026-11-15' },
  ],
};

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk.toString()));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Creates and returns an instance of the Mock REST HTTP server.
 */
export function createMockServer(options: MockServerOptions = {}): {
  server: Server;
  store: MockStore;
} {
  const delay = options.delay || 0;
  const chaosRate = options.chaos || 0;
  const store: MockStore = JSON.parse(JSON.stringify(DEFAULT_STORE));

  // Load custom data file if provided
  if (options.dataFile && fs.existsSync(options.dataFile)) {
    try {
      const customData = fs.readJSONSync(options.dataFile);
      if (typeof customData === 'object' && customData !== null) {
        Object.assign(store, customData);
      }
    } catch {
      // Fallback to default store
    }
  }

  const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const startTime = Date.now();
    const method = req.method?.toUpperCase() || 'GET';
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Set standard CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    // Chaos rate simulation: trigger 500 error if random < chaosRate
    if (chaosRate > 0 && Math.random() < chaosRate) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Chaos Simulation: Internal Server Error', chaos: true }));
      if (!options.silent) {
        console.log(` ${pc.red(method)} ${pc.white(pathname)} -> ${pc.red('500 Chaos')} (${Date.now() - startTime}ms)`);
      }
      return;
    }

    // Health check endpoint
    if (pathname === '/health' || pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), mock: true }));
      if (!options.silent) {
        console.log(` ${pc.green(method)} ${pc.white(pathname)} -> ${pc.green('200 OK')} (${Date.now() - startTime}ms)`);
      }
      return;
    }

    // Parse resource route: /api/:collection or /:collection, with optional /:id
    const parts = pathname.replace(/^\/api\//, '/').split('/').filter(Boolean);
    const collectionName = parts[0];
    const itemId = parts[1];

    if (!collectionName || !store[collectionName]) {
      // List available collections if root or 404
      if (pathname === '/' || pathname === '/api') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message: 'vibe mock API server active',
            availableCollections: Object.keys(store).map((k) => `/api/${k}`),
          })
        );
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Collection '${collectionName}' not found` }));
      }
      return;
    }

    const collection = store[collectionName];

    // GET /api/:collection or GET /api/:collection/:id
    if (method === 'GET') {
      if (itemId) {
        const item = collection.find((i) => String(i.id) === itemId);
        if (item) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(item));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Item ${itemId} not found in ${collectionName}` }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(collection));
      }
    }
    // POST /api/:collection
    else if (method === 'POST') {
      const body = await parseJsonBody(req);
      const newItem = { id: String(Date.now()), ...body };
      collection.push(newItem);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newItem));
    }
    // PUT /api/:collection/:id
    else if (method === 'PUT' || method === 'PATCH') {
      if (!itemId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item ID required for update' }));
        return;
      }
      const body = await parseJsonBody(req);
      const idx = collection.findIndex((i) => String(i.id) === itemId);
      if (idx !== -1) {
        collection[idx] = { ...collection[idx], ...body, id: itemId };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(collection[idx]));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Item ${itemId} not found` }));
      }
    }
    // DELETE /api/:collection/:id
    else if (method === 'DELETE') {
      if (!itemId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Item ID required for delete' }));
        return;
      }
      const idx = collection.findIndex((i) => String(i.id) === itemId);
      if (idx !== -1) {
        const deleted = collection.splice(idx, 1)[0];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ deleted: true, item: deleted }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Item ${itemId} not found` }));
      }
    } else {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Method ${method} not allowed` }));
    }

    if (!options.silent) {
      const statusColor = res.statusCode < 300 ? pc.green : res.statusCode < 400 ? pc.cyan : pc.red;
      console.log(` ${pc.bold(method)} ${pc.white(pathname)} -> ${statusColor(res.statusCode.toString())} (${Date.now() - startTime}ms)`);
    }
  });

  return { server, store };
}

/**
 * vibe mock [dataFile]
 */
export async function mockCommand(
  dataFile?: string,
  options: { port?: number; delay?: number; chaos?: number } = {}
): Promise<void> {
  const port = options.port || 4000;
  const delay = options.delay || 0;
  const chaos = options.chaos || 0;

  p.intro(pc.bgCyan(pc.black(' vibe mock ')) + ' ' + pc.bold('Instant Zero-Dependency REST API Server'));

  const { server, store } = createMockServer({
    port,
    delay,
    chaos,
    dataFile: dataFile ? path.resolve(dataFile) : undefined,
    silent: false,
  });

  server.listen(port, () => {
    const collections = Object.keys(store);
    p.note(
      `Listening on:   ${pc.bold(pc.green(`http://localhost:${port}`))}\n` +
        `Simulated Delay: ${pc.yellow(`${delay}ms`)}\n` +
        `Chaos Error:    ${chaos > 0 ? pc.red(`${(chaos * 100).toFixed(0)}%`) : pc.dim('Disabled (0%)')}\n` +
        `Data Source:    ${dataFile ? pc.cyan(dataFile) : pc.dim('In-Memory Default Store')}\n\n` +
        `Available REST Collections:\n` +
        collections.map((c) => `  • ${pc.bold(pc.white(`GET /api/${c}`))} ${pc.dim(`(${store[c].length} items)`)}`).join('\n') +
        `\n\nFull CRUD enabled: GET, POST, PUT, DELETE with CORS headers for React/Flutter/Vue!`,
      'Mock API Server Active'
    );

    p.log.info('Press Ctrl+C to terminate mock server.');
  });
}
