import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SVGPathInterpolator } from '../lib/SVGPathInterpolator.js';
import { createInterpolator } from '../lib/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const settings = { minDistance: 0, roundToNearest: 1, sampleFrequency: 0.5 };

function interpolate(path, options = {}) {
  return new SVGPathInterpolator({ ...settings, ...options }).interpolatePath(path);
}

test('samples absolute, relative, horizontal, and vertical lines', () => {
  assert.deepEqual(interpolate('M0 0 L10 0'), [5, 0, 10, 0]);
  assert.deepEqual(interpolate('M5 5 l10 0'), [10, 5, 15, 5]);
  assert.deepEqual(interpolate('M0 0 h10 v10'), [5, 0, 10, 0, 10, 5, 10, 10]);
});

test('supports repeated line segments and closes a subpath', () => {
  assert.deepEqual(interpolate('M0 0 L10 0 10 10 Z'), [5, 0, 10, 0, 10, 5, 10, 10, 5, 5, 0, 0]);
});

test('parses leading decimals and exponent notation', () => {
  assert.deepEqual(interpolate('M0 0 L.5 .5', { roundToNearest: 0.25 }), [0.25, 0.25, 0.5, 0.5]);
  assert.deepEqual(interpolate('M0 0 L1e2 0'), [50, 0, 100, 0]);
});

test('samples smooth quadratic curves', () => {
  assert.deepEqual(interpolate('M0 0 T10 10'), [2, 2, 10, 10]);
  assert.deepEqual(interpolate('M0 0 Q10 0 10 10 T20 20'), [7, 2, 10, 10, 12, 17, 20, 20]);
  assert.deepEqual(interpolate('M0 0 t10 10 t10 10'), [2, 2, 10, 10, 17, 17, 20, 20]);
});

test('trims both coordinate axes to zero', () => {
  assert.deepEqual(interpolate('M10 20 L20 30', { trim: true }), [0, 0, 5, 5]);
});

test('parses SVG paths and applies an ancestor transform', async () => {
  const require = createRequire(import.meta.url);
  const wasm = await readFile(require.resolve('sax-wasm/lib/sax-wasm.wasm'));
  const interpolator = await createInterpolator({ ...settings, joinPathData: false }, new Uint8Array(wasm));
  const svg = new TextEncoder().encode('<svg><g transform="translate(10 20)"><path id="line" d="M0 0 L10 0"/></g></svg>');
  assert.deepEqual(interpolator.processSVG(svg), { line: [15, 20, 20, 20] });
});

test('loads the SAX WASM from a browser-style URL', async () => {
  const require = createRequire(import.meta.url);
  const wasm = await readFile(require.resolve('sax-wasm/lib/sax-wasm.wasm'));
  const wasmUrl = `data:application/wasm;base64,${wasm.toString('base64')}`;
  const interpolator = await createInterpolator({ ...settings }, wasmUrl);
  const svg = new TextEncoder().encode('<svg><path id="line" d="M0 0 L10 0"/></svg>');
  assert.deepEqual(interpolator.processSVG(svg), { line: [5, 0, 10, 0] });
});

test('CLI entry resolves to a packaged file and emits JSON', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.bin.svgpi, './lib/cli.js');
  const result = spawnSync(process.execPath, [join(root, 'lib/cli.js'), join(root, 'config/sample.config.json'), join(root, 'examples/simpleCubic.svg')], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(Array.isArray(JSON.parse(result.stdout)));
});
