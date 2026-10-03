// Mechanical packaging only: the authored game remains public/index.html.
// Embed the already-vendored, MIT-licensed renderer and core in one portable HTML.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const [html, core, renderer, license] = await Promise.all([
  readFile(path.join(directory, 'index.html'), 'utf8'),
  readFile(path.join(directory, 'vendor/three.core.js'), 'utf8'),
  readFile(path.join(directory, 'vendor/three.module.js'), 'utf8'),
  readFile(path.join(directory, 'vendor/THREE-LICENSE.txt'), 'utf8')
]);
if (!core.includes("const REVISION = '180'")) throw new Error('Unexpected vendored Three.js release');
await writeFile(path.join(directory, 'skybreak.html'), html);
const safeJSON = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const library =
  '<script type="application/json" id="bundled-three-core">' +
  safeJSON(core) +
  '</script>\n' +
  '<script type="application/json" id="bundled-three-renderer">' +
  safeJSON(renderer) +
  '</script>\n' +
  '<!-- Embedded renderer license:\n' +
  license.replaceAll('--', '—') +
  '\n-->\n';
const loader = `async function loadBundledThree() {
  // Blob modules work from file:// as well as localhost, with no network fetch.
  const core = JSON.parse(document.getElementById('bundled-three-core').textContent);
  const coreURL = URL.createObjectURL(new Blob([core], {type:'text/javascript'}));
  const renderer = JSON.parse(document.getElementById('bundled-three-renderer').textContent);
  const moduleURL = URL.createObjectURL(new Blob([renderer.replaceAll('./three.core.js', coreURL)], {type:'text/javascript'}));
  try { return await import(moduleURL); }
  finally { URL.revokeObjectURL(moduleURL); URL.revokeObjectURL(coreURL); }
}
`;
const loaderPattern = /async function loadRenderer\(\) \{[\s\S]*?(?=\n      const \$)/;
if (!loaderPattern.test(html)) throw new Error('Game loader changed; update offline packager');
// A callback preserves literal replacement tokens (for example "$&") in the library source.
let offline = html.replace(
  '<script type="module" id="game-code">',
  () => library + '<script type="module" id="game-code">\n' + loader
);
offline = offline
  .replace(loaderPattern, 'async function loadRenderer() { return loadBundledThree(); }')
  .replace('CDN timeout', 'Bundled renderer timeout')
  .replace(
    'Enable WebGL 2 / graphics acceleration. Localhost uses the included renderer; a moved source HTML needs internet for its CDN fallback. Reload or try Performance quality.',
    'This offline edition needs WebGL 2 / browser graphics acceleration. No internet connection is required. Reload or try another browser.'
  )
  .replace('WEBGL / READY', 'OFFLINE / READY');
await mkdir(path.join(directory, 'offline'), { recursive: true });
await writeFile(path.join(directory, 'offline/index.html'), offline);
console.log('Offline game built: ' + path.join(directory, 'offline/index.html'));
