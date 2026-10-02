import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
test('all four complete delivered scripts pass the JavaScript parser', () => {
  for (const pattern of [
    /<script id="flight-core">([\s\S]*?)<\/script>/,
    /<script id="duel-core">([\s\S]*?)<\/script>/,
    /<script id="battle-audio">([\s\S]*?)<\/script>/,
    /<script type="module" id="game-code">([\s\S]*?)<\/script>/
  ]) {
    const script = html.match(pattern)[1];
    const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
      input: script,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
  }
});
test('the document has unique element identifiers and a local-first renderer loader', () => {
  const document = html.slice(0, html.indexOf('<script id="flight-core">'));
  const ids = [...document.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  const loader = html.slice(html.indexOf('async function loadRenderer()'), html.indexOf('const $ = (id)'));
  assert.ok(loader.indexOf("import('./vendor/three.module.js')") >= 0);
  assert.ok(
    loader.indexOf("import('./vendor/three.module.js')") < loader.indexOf("import('https://unpkg.com/")
  );
});
