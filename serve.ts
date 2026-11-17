// Local playtest server for Emberfall. Serves this repository over HTTP so the
// game loads the way a browser loads the staged game/ (ES modules need http(s),
// not file://). Usage: node serve.ts [port] — the port defaults to 8080, or
// the PORT environment variable. Open http://localhost:8080 to play.

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[2] ?? process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  // The root redirects to the game page: serving index.html at / would break
  // its relative ./src/ imports (they would resolve to /src/ instead).
  if (pathname === '/') {
    res.writeHead(302, { location: '/game/index.html' });
    res.end();
    return;
  }
  const file = normalize(join(root, pathname));
  // Never serve outside the repository, whatever the path asks for.
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found\n');
    return;
  }
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(file));
});

server.listen(port, () => {
  console.log(`Emberfall at http://localhost:${port}/ (serving ${root})`);
});
