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

async function processSVG(source, options = {}) {
  const require = createRequire(import.meta.url);
  const wasm = await readFile(require.resolve('sax-wasm/lib/sax-wasm.wasm'));
  const interpolator = await createInterpolator(
    { ...settings, joinPathData: false, ...options },
    new Uint8Array(wasm)
  );
  return interpolator.processSVG(new TextEncoder().encode(source));
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
  assert.deepEqual(
    await processSVG('<svg><g transform="translate(10 20)"><path id="line" d="M0 0 L10 0"/></g></svg>'),
    { line: [15, 20, 20, 20] }
  );
});

test('composes every operation in an SVG transform list in SVG order', async () => {
  assert.deepEqual(
    await processSVG('<svg><path id="line" transform="translate(10 0) scale(2)" d="M0 0 L10 0"/></svg>'),
    { line: [20, 0, 30, 0] }
  );
});

test('defaults a single-argument translation y value to zero', async () => {
  assert.deepEqual(
    await processSVG('<svg><path id="line" transform="translate(10)" d="M0 5 L10 5"/></svg>'),
    { line: [15, 5, 20, 5] }
  );
});

test('composes matrix operations with earlier transforms in a list', async () => {
  assert.deepEqual(
    await processSVG('<svg><path id="line" transform="translate(10 0) matrix(2 0 0 1 0 0)" d="M0 0 L10 0"/></svg>'),
    { line: [20, 0, 30, 0] }
  );
});

test('composes nested parent and child transforms', async () => {
  assert.deepEqual(
    await processSVG('<svg><g transform="translate(10 0)"><g transform="scale(2)"><path id="line" d="M0 0 L10 0"/></g></g></svg>'),
    { line: [20, 0, 30, 0] }
  );
});

test('applies transforms declared directly on a path', async () => {
  assert.deepEqual(
    await processSVG('<svg><path id="line" transform="translate(5 10)" d="M0 0 L10 0"/></svg>'),
    { line: [10, 10, 15, 10] }
  );
});

test('supports rotation centers, matrices, and skew transforms', async () => {
  const result = await processSVG(`
    <svg>
      <path id="rotated" transform="rotate(90 10 0)" d="M10 0 L20 0"/>
      <path id="matrix" transform="matrix(2 0 0 3 4 5)" d="M0 0 L10 0"/>
      <path id="skewed" transform="skewX(45)" d="M0 10 L10 10"/>
    </svg>
  `, { roundToNearest: 0.000001 });

  assert.deepEqual(result.rotated, [10, 5, 10, 10]);
  assert.deepEqual(result.matrix, [14, 5, 24, 5]);
  assert.ok(Math.abs(result.skewed[0] - 15) < 0.00001);
  assert.ok(Math.abs(result.skewed[2] - 20) < 0.00001);
  assert.deepEqual([result.skewed[1], result.skewed[3]], [10, 10]);
});

test('rejects invalid numeric interpolation options at construction', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new SVGPathInterpolator({ minDistance: value }),
      { name: 'RangeError', message: /minDistance must be a finite number greater than or equal to 0/ }
    );
  }
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new SVGPathInterpolator({ roundToNearest: value }),
      { name: 'RangeError', message: /roundToNearest must be a finite number greater than 0/ }
    );
  }
  for (const value of [0, -1, 0.0000009, 1.000001, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new SVGPathInterpolator({ sampleFrequency: value }),
      { name: 'RangeError', message: /sampleFrequency must be a finite number between 0\.000001 and 1, inclusive/ }
    );
  }

  assert.doesNotThrow(() => new SVGPathInterpolator({
    minDistance: 0,
    roundToNearest: Number.MIN_VALUE,
    sampleFrequency: 0.000001
  }));
});

test('rejects numeric options mutated after construction before sampling', () => {
  const invalidOptions = [
    ['minDistance', -1, /minDistance must be a finite number greater than or equal to 0/],
    ['roundToNearest', 0, /roundToNearest must be a finite number greater than 0/],
    ['sampleFrequency', 0.0000009, /sampleFrequency must be a finite number between 0\.000001 and 1, inclusive/]
  ];

  for (const [name, value, expectedMessage] of invalidOptions) {
    const interpolator = new SVGPathInterpolator(settings);
    interpolator[name] = value;
    assert.throws(
      () => interpolator.interpolatePath('M0 0 L10 0'),
      { name: 'RangeError', message: expectedMessage }
    );
  }
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
