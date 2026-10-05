#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInterpolator } from './index.js';
import type { SVGInterpolatorConfig } from './SVGPathInterpolator.js';

interface CliConfig extends Omit<SVGInterpolatorConfig, 'parser'> {
  pretty?: boolean;
  prettyIndent?: number;
}

async function main() {
  const [configPath, svgPath, outputPath] = process.argv.slice(2);
  if (!configPath || !svgPath) {
    throw new Error('Usage: svgpi <config.json> <input.svg> [output.json]');
  }

  const config = JSON.parse(await readFile(configPath, 'utf8')) as CliConfig;
  const svg = await readFile(svgPath);
  const wasm = await readFile(new URL(import.meta.resolve('sax-wasm/lib/sax-wasm.wasm')));
  const interpolator = await createInterpolator(config, new Uint8Array(wasm));
  const result = interpolator.processSVG(new Uint8Array(svg));
  const json = JSON.stringify(result, null, config.pretty ? config.prettyIndent : 0);

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, json);
  } else {
    console.log(json);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
