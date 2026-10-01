import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8'
};
const withinRoot = (file) => file.startsWith(root + path.sep);

export function createGameServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const error = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : message);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return error(405, 'Only GET and HEAD are supported.');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return error(400, 'Invalid URL encoding.');
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return error(400, 'Invalid path.');
    if (pathname.split('/').some((part) => part.startsWith('.') && part !== '..'))
      return error(403, 'This path is not public.');
    if (pathname.endsWith('/')) pathname += 'index.html';
    const requested = path.resolve(root, '.' + pathname);
    if (!withinRoot(requested)) return error(403, 'This path is not public.');
    try {
      const file = await realpath(requested);
      if (!withinRoot(file)) return error(403, 'This path is not public.');
      const info = await stat(file);
      if (!info.isFile()) return error(404, 'Not found.');
      const etag = 'W/"' + info.size.toString(16) + '-' + Math.trunc(info.mtimeMs).toString(16) + '"';
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'no-cache');
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304);
        return res.end();
      }
      const data = req.method === 'HEAD' ? null : await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': data?.length ?? info.size
      });
      res.end(data);
    } catch (failure) {
      error(
        ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(failure.code) ? 404 : 500,
        ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(failure.code)
          ? 'Not found.'
          : 'Unable to read this game file.'
      );
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3040);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a whole number between 1 and 65535.');
    process.exitCode = 1;
  } else {
    const server = createGameServer();
    server.on('error', (error) => {
      console.error(
        error.code === 'EADDRINUSE'
          ? `Port ${port} is already in use. The game may already be running: open http://localhost:${port}/ .\nFor a second instance, use PORT=${port === 65535 ? 3041 : port + 1} npm start. No existing process was stopped.`
          : `Could not start the game server: ${error.message}`
      );
      process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () =>
      console.log(
        `SKYBREAK ready at http://localhost:${port}/\nLocal renderer included; no internet required. Ctrl+C stops this server.`
      )
    );
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      server.close(() => {
        process.exitCode = 0;
      });
      server.closeIdleConnections();
      setTimeout(() => server.closeAllConnections(), 2000).unref();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
}
