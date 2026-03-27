import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { ParsedProject } from '../parser.js';
import { renderHtml } from './template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  port: number;
}

export interface ServerHandle {
  updateData(project: ParsedProject): void;
  stop(): Promise<void>;
  readonly url: string;
}

export async function startServer(
  initialData: ParsedProject,
  options: ServerOptions,
): Promise<ServerHandle> {
  let currentData = initialData;
  const sseClients = new Set<(data: string) => void>();

  const app = new Hono();

  app.get('/', (c) => {
    return c.html(renderHtml(currentData));
  });

  app.get('/viewer-client.js', async (c) => {
    // dist/viewer/viewer-client.js — tsup のブラウザバンドル出力先
    const jsPath = path.resolve(__dirname, '../viewer/viewer-client.js');
    try {
      const content = await readFile(jsPath, 'utf8');
      return c.body(content, { headers: { 'Content-Type': 'application/javascript' } });
    } catch {
      return c.text('// viewer-client.js not found. Run `pnpm build` first.', 404);
    }
  });

  app.get('/api/specs', (c) => {
    return c.json({
      project: currentData.config.project,
      screens: currentData.screens,
      setups: currentData.setups,
      units: currentData.units,
      workflows: currentData.workflows,
    });
  });

  app.get('/events', (c) => {
    return streamSSE(c, async (stream) => {
      const send = (data: string) => {
        stream.writeSSE({ data, event: 'update' });
      };

      sseClients.add(send);
      stream.onAbort(() => sseClients.delete(send));

      await stream.writeSSE({ data: 'connected', event: 'open' });
      await new Promise<void>((resolve) => stream.onAbort(resolve));
    });
  });

  const { server, url } = await new Promise<{ server: ServerType; url: string }>((resolve) => {
    const s = serve({ fetch: app.fetch, port: options.port }, (info) => {
      resolve({ server: s, url: `http://localhost:${info.port}` });
    });
  });

  return {
    updateData(project: ParsedProject) {
      currentData = project;
      for (const send of sseClients) {
        send('reload');
      }
    },

    async stop() {
      sseClients.clear();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },

    get url() {
      return url;
    },
  };
}
