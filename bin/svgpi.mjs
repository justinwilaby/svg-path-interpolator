#!/usr/bin/env node

//https://pomax.github.io/bezierinfo/
import fs from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';
import { createInterpolator } from '../lib/index.js';

const require = createRequire(import.meta.url);
const [ , ,configPath, svgFile, outputFile ] = process.argv;
async function read(file) {
  try {
    await fs.access(file)
    return fs.readFile(file);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

async function runJob(configJson) {
  const config = JSON.parse(configJson.toString());
  const file = path.normalize(svgFile);
  const svg = await read(file);
  const wasm = await read(require.resolve('sax-wasm/lib/sax-wasm.wasm'));
  const interpolator = await createInterpolator(config, new Uint8Array(wasm));
  const json = interpolator.processSVG(new Uint8Array(svg));
  const jsonStr = JSON.stringify(json, null, (config.pretty ? config.prettyIndent:0));
  if (outputFile) {
    try {
      const { dir } = path.parse(outputFile);
      await fs.mkdir(dir, {recursive: true});
      await fs.writeFile(path.normalize(outputFile), Buffer.from(jsonStr));
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  } else {
    console.log(jsonStr);
  }
}

read(configPath).then(runJob);
