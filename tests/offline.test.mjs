import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const offline = readFileSync(new URL('../public/offline/index.html', import.meta.url), 'utf8');
const canonical = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const bundled = (id) =>
  JSON.parse(
    offline.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)<\\/script>'))[1]
  );
test('offline copy embeds exact licensed renderer sources rather than external asset links', () => {
  assert.equal(
    bundled('bundled-three-core'),
    readFileSync(new URL('../public/vendor/three.core.js', import.meta.url), 'utf8')
  );
  assert.equal(
    bundled('bundled-three-renderer'),
    readFileSync(new URL('../public/vendor/three.module.js', import.meta.url), 'utf8')
  );
  assert.match(offline, /The MIT License/);
  assert.match(offline, /Copyright © 2010-2025 three.js authors/);
  assert.doesNotMatch(offline, /import\('https:/);
  assert.match(offline, /URL\.createObjectURL\(new Blob/);
  assert.match(offline, /replaceAll\('\.\/three.core.js', coreURL\)/);
});
test('offline bundle preserves the authored flight core and every gameplay function', () => {
  const core = (html) => html.match(/<script id="flight-core">([\s\S]*?)<\/script>/)[1];
  const game = (html) => html.match(/function startGame\(THREE\)\s*\{([\s\S]*?)<\/script>/)[1];
  assert.equal(core(offline), core(canonical));
  assert.equal(offline.match(/<script id="battle-audio">([\s\S]*?)<\/script>/)[1], canonical.match(/<script id="battle-audio">([\s\S]*?)<\/script>/)[1]);
  assert.equal(game(offline), game(canonical).replace('WEBGL / READY', 'OFFLINE / READY'));
});
test('offline module dependencies are fully closed over the embedded core', () => {
  const renderer = bundled('bundled-three-renderer'),
    core = bundled('bundled-three-core');
  const references = [...renderer.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.ok(references.length > 0);
  assert.ok(references.every((path) => path === './three.core.js'));
  assert.doesNotMatch(core, /^import .* from /m);
});
