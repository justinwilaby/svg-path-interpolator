import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
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
  assert.deepEqual(interpolate('M0.6.5 L1.6.5', { roundToNearest: 0.25 }), [1, 0.5, 1.5, 0.5]);
  assert.doesNotThrow(() => interpolate('M0 0 A5 5 0 0110 10'));
});

test('accepts every SVG path command, repeated groups, and supported arc variants', () => {
  assert.doesNotThrow(() => interpolate(
    'M0 0 5 5 L10 0 15 5 H20 25 V10 15 C20 20 25 20 30 15 S35 10 40 15 Q45 20 50 15 T60 15 A5 5 0 0 1 70 15 A-5 -5 0 1 0 80 15 A0 5 0 0 0 90 15 Z'
  ));
  assert.doesNotThrow(() => interpolate(
    'm0 0 5 5 l5 -5 5 5 h5 5 v5 5 c0 5 5 5 10 0 s5 -5 10 0 q5 5 10 0 t10 0 a5 5 0 0 1 10 0 z'
  ));
});

test('rejects malformed, unsupported, and incomplete SVG path data', () => {
  const invalidPaths = [
    'L10 0',
    'M0',
    'M0 0 L10',
    'M0 0 C1 2 3 4 5',
    'M0 0 A10 10 0 2 0 10 10',
    'M0 0 A10 10 0 0 1 10',
    'M0 0 Z 10 10',
    'M0 0 X10 10',
    'M0 0 L10 10!',
    'M0 0,'
  ];

  for (const path of invalidPaths) {
    assert.throws(() => interpolate(path), /Invalid SVG path data/);
  }
});

test('treats empty and none path data as no-path values', async () => {
  assert.deepEqual(interpolate(''), []);
  assert.deepEqual(interpolate('  none  '), []);
  assert.deepEqual(
    await processSVG('<svg><path id="empty" d=""/><path id="none" d="none"/></svg>'),
    { empty: [], none: [] }
  );
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

test('rejects malformed SVG transforms and invalid transform arities', async () => {
  const invalidTransforms = [
    '',
    'translate()',
    'translate(1 2 3)',
    'scale(1 2 3)',
    'rotate(10 1)',
    'matrix(1 0 0 1 0)',
    'skewX(10 20)',
    'spin(10)',
    'translate(nope)',
    'translate(10',
    'translate(10) garbage',
  ];

  for (const transform of invalidTransforms) {
    await assert.rejects(
      processSVG(`<svg><path transform="${transform}" d="M0 0 L10 0"/></svg>`),
      /Invalid SVG transform/
    );
  }
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

test('rejects invalid sampling budgets at construction and after mutation', () => {
  for (const name of ['maxSamples', 'maxOutputPoints']) {
    for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(
        () => new SVGPathInterpolator({ [name]: value }),
        { name: 'RangeError', message: new RegExp(`${name} must be a finite positive integer`) }
      );
    }
  }

  const interpolator = new SVGPathInterpolator({ ...settings, maxSamples: 10 });
  interpolator.maxSamples = 0;
  assert.throws(
    () => interpolator.interpolatePath('M0 0 L10 0'),
    { name: 'RangeError', message: /maxSamples must be a finite positive integer/ }
  );
});

test('enforces sample and output budgets before exceeding them', () => {
  assert.throws(
    () => interpolate('M0 0 L10 0', { maxSamples: 2 }),
    { name: 'RangeError', message: /maxSamples of 2 would be exceeded/ }
  );
  assert.throws(
    () => interpolate('M0 0 L10 0', { maxOutputPoints: 1 }),
    { name: 'RangeError', message: /maxOutputPoints of 1 would be exceeded/ }
  );
  assert.throws(
    () => interpolate('M0 0 A10 10 0 0 1 20 0', { maxSamples: 1 }),
    { name: 'RangeError', message: /maxSamples of 1 would be exceeded/ }
  );
});

test('shares output budgets across every path in an SVG', async () => {
  await assert.rejects(
    processSVG('<svg><path d="M0 0 L10 0"/><path d="M0 0 L10 0"/></svg>', { maxOutputPoints: 3 }),
    { name: 'RangeError', message: /maxOutputPoints of 3 would be exceeded/ }
  );
});

test('shares sample budgets across SVG paths and decomposed arcs', async () => {
  await assert.rejects(
    processSVG('<svg><path d="M0 0 A10 10 0 0 1 20 0"/><path d="M0 0 L10 0"/></svg>', { maxSamples: 4 }),
    { name: 'RangeError', message: /maxSamples of 4 would be exceeded/ }
  );
  await assert.rejects(
    processSVG('<svg><path d="M0 0 A10 10 0 1 1 20 0"/></svg>', { maxSamples: 3 }),
    { name: 'RangeError', message: /maxSamples of 3 would be exceeded/ }
  );
});

test('revalidates mutated budgets before processing an SVG', async () => {
  const require = createRequire(import.meta.url);
  const wasm = await readFile(require.resolve('sax-wasm/lib/sax-wasm.wasm'));
  const interpolator = await createInterpolator({ ...settings, maxSamples: 10 }, new Uint8Array(wasm));
  interpolator.maxSamples = 0;
  assert.throws(
    () => interpolator.processSVG(new TextEncoder().encode('<svg><path d="M0 0 L10 0"/></svg>')),
    { name: 'RangeError', message: /maxSamples must be a finite positive integer/ }
  );
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

test('CLI prints a concise validation error without a stack trace', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'svgpi-'));
  const configPath = join(directory, 'config.json');
  const svgPath = join(directory, 'invalid.svg');
  try {
    await writeFile(configPath, JSON.stringify({ ...settings, maxSamples: 0 }));
    await writeFile(svgPath, '<svg><path d="M0 0 L10 0"/></svg>');
    const result = spawnSync(process.execPath, [join(root, 'lib/cli.js'), configPath, svgPath], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr.trim(), /^maxSamples must be a finite positive integer$/);
    assert.doesNotMatch(result.stderr, /\n\s+at\s/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
