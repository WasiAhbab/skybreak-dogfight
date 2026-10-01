import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createGameServer } from '../server.mjs';
import { spawn } from 'node:child_process';

let server, base;
before(async () => {
  server = createGameServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
test('root serves a launchable game', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /LAUNCH|PREPARING AIRCRAFT/);
});
test('standalone HTML is served as a complete game document', async () => {
  const res = await fetch(base + '/skybreak.html');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /id="flight-core"/);
  assert.match(html, /id="game-code"/);
  assert.match(html, /unpkg.com\/three@0.180.0/);
});
test('preserved legacy assets remain available with correct MIME types', async () => {
  for (const file of [
    'main.js',
    'world.js',
    'flight-math.js',
    'flight-controller.js',
    'arena-layout.js',
    'combat-hud.js',
    'smoke.js',
    'vendor/three.module.js',
    'vendor/three.core.js'
  ]) {
    const res = await fetch(base + '/' + file);
    assert.equal(res.status, 200, file);
    assert.match(res.headers.get('content-type'), /javascript/);
    await res.arrayBuffer();
  }
  const css = await fetch(base + '/style.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
  await css.arrayBuffer();
});
test('server refuses encoded traversal outside public files', async () => {
  const res = await fetch(base + '/..%2fserver.mjs');
  assert.equal(res.status, 403);
});
test('missing files return a proper 404', async () => {
  assert.equal((await fetch(base + '/missing-file.png')).status, 404);
});
test('HEAD serves the same metadata with no response body', async () => {
  const get = await fetch(base + '/');
  const length = (await get.arrayBuffer()).byteLength;
  const head = await fetch(base + '/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), length);
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(head.headers.get('referrer-policy'), 'no-referrer');
});
test('conditional requests revalidate and do not send an unchanged bundle', async () => {
  const first = await fetch(base + '/');
  const etag = first.headers.get('etag');
  await first.text();
  assert.ok(etag);
  const next = await fetch(base + '/', { headers: { 'If-None-Match': etag } });
  assert.equal(next.status, 304);
  assert.equal(await next.text(), '');
});
test('offline directory, methods, malformed paths and dotfiles return deliberate statuses', async () => {
  const offline = await fetch(base + '/offline/');
  assert.equal(offline.status, 200);
  await offline.text();
  const post = await fetch(base + '/', { method: 'POST', body: 'not a save endpoint' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
  await post.text();
  for (const [url, code] of [
    ['/%ZZ', 400],
    ['/%00', 400],
    ['/.env', 403],
    ['/vendor/', 404]
  ]) {
    const response = await fetch(base + url);
    assert.equal(response.status, code);
    await response.text();
  }
});
test('occupied ports explain recovery without killing the existing server', async () => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(server.address().port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (data) => {
    stderr += data;
  });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(stderr, /already in use/);
  assert.match(stderr, /No existing process was stopped/);
  assert.doesNotMatch(stderr, /Unhandled/);
  const stillRunning = await fetch(base + '/');
  assert.equal(stillRunning.status, 200);
  await stillRunning.text();
});
