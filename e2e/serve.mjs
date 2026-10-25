// Serves the production frontend build and proxies /api to the E2E backend,
// so the browser sees one origin, as with the Vite dev proxy.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5180);
const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
const DIST = fileURLToPath(new URL('../frontend/dist', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  if (req.url.startsWith('/api')) {
    const upstream = http.request({ host: 'localhost', port: API_PORT, path: req.url, method: req.method, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode, up.headers);
      up.pipe(res);
    });
    req.pipe(upstream);
    upstream.on('error', () => { res.writeHead(502); res.end(); });
    return;
  }
  const path = normalize(req.url.split('?')[0]).replace(/^(\.\.[/\\])+/, '');
  const file = join(DIST, path === '/' ? 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
}).listen(PORT, () => console.log(`frontend on http://localhost:${PORT}`));
