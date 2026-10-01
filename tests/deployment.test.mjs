import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

test('Vercel publishes only static game assets and does not launch a persistent Node server', () => {
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.equal(config.installCommand, '');
  assert.equal(config.buildCommand, 'npm run build:offline');
  assert.equal(config.functions, undefined);
  for (const file of ['index.html', 'vendor/three.module.js', 'vendor/three.core.js', 'vendor/THREE-LICENSE.txt'])
    assert.ok(existsSync(new URL('../public/' + file, import.meta.url)), file);
  assert.equal(existsSync(new URL('../public/server.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../public/package.json', import.meta.url)), false);
});

test('hosted game retains security headers without blocking camera controls or inline game scripts', () => {
  const headers = Object.fromEntries(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
  assert.equal(headers['Cross-Origin-Embedder-Policy'], undefined);
  assert.equal(headers['Content-Security-Policy'], undefined);
  assert.match(headers['Cache-Control'], /must-revalidate/);
});
