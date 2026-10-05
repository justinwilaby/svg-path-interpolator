import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'svgpi-package-'));
const commandSuffix = process.platform === 'win32' ? '.cmd' : '';
const npmCommand = `npm${commandSuffix}`;

function packageBinary(directory, name) {
  return join(directory, 'node_modules', '.bin', `${name}${commandSuffix}`);
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_cache: join(temporaryDirectory, 'npm-cache') },
  });
  if (result.error) {
    throw result.error;
  }
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stderr}`);
  return result.stdout.trim();
}

try {
  const [packageInfo] = JSON.parse(
    run(npmCommand, ['pack', '--json', '--pack-destination', temporaryDirectory]),
  );
  const packagedFiles = new Set(packageInfo.files.map(({ path }) => path));
  for (const path of [
    'CHANGELOG.md',
    'lib/cli.js',
    'lib/cli.d.ts',
    'lib/index.js',
    'lib/index.d.ts',
    'lib/SVGPathInterpolator.js',
    'lib/SVGPathInterpolator.d.ts',
  ]) {
    assert.ok(packagedFiles.has(path), `Package is missing ${path}`);
  }
  assert.ok(
    ![...packagedFiles].some((path) => path.startsWith('lib/sax-wasm/')),
    'Package still contains a copied sax-wasm dependency',
  );
  assert.ok(!packagedFiles.has('bin/svgpi.mjs'), 'Package contains the old JavaScript CLI');

  const consumer = join(temporaryDirectory, 'consumer');
  await mkdir(consumer);
  run(
    npmCommand,
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      join(temporaryDirectory, packageInfo.filename),
    ],
    consumer,
  );

  const consumerRequire = createRequire(join(consumer, 'package.json'));
  const { createInterpolator, SVGPathInterpolator } = await import(
    pathToFileURL(consumerRequire.resolve('svg-path-interpolator')).href
  );
  assert.equal(typeof SVGPathInterpolator, 'function');
  const wasm = await readFile(join(consumer, 'node_modules', 'sax-wasm', 'lib', 'sax-wasm.wasm'));
  const options = { minDistance: 0, roundToNearest: 1, sampleFrequency: 0.5 };
  const interpolator = await createInterpolator(options, new Uint8Array(wasm));
  const svg = '<svg><path id="line" d="M0 0 L10 0"/></svg>';
  assert.deepEqual(interpolator.processSVG(new TextEncoder().encode(svg)), {
    line: [5, 0, 10, 0],
  });

  const svgFile = join(consumer, 'line.svg');
  const configFile = join(consumer, 'config.json');
  await writeFile(svgFile, svg);
  await writeFile(configFile, JSON.stringify(options));
  const cliOutput = run(packageBinary(consumer, 'svgpi'), [configFile, svgFile], consumer);
  assert.deepEqual(JSON.parse(cliOutput), { line: [5, 0, 10, 0] });

  await writeFile(
    join(consumer, 'consumer.mts'),
    [
      "import { createInterpolator, SVGPathInterpolator, type SVGInterpolatorConfig } from 'svg-path-interpolator';",
      'const config: SVGInterpolatorConfig = { joinPathData: true };',
      'new SVGPathInterpolator(config).interpolatePath("M0 0 L10 0");',
      'createInterpolator(config, new Uint8Array());',
    ].join('\n'),
  );
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        noEmit: true,
      },
      include: ['consumer.mts'],
    }),
  );
  run(packageBinary(root, 'tsc'), ['-p', 'tsconfig.json'], consumer);

  console.log(`Verified ${packageInfo.id}: files, imports, WASM, CLI, and declarations`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
