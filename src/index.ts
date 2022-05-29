import { SaxEventType, SAXParser } from 'sax-wasm';
import { SVGInterpolatorConfig, SVGPathInterpolator } from './SVGPathInterpolator';

async function getParser(saxWasmPath) {
  const wasmResponse = await fetch(saxWasmPath);
  if (!wasmResponse.ok){
    throw new Error(`Cannot load the parser at ${saxWasmPath}`);
  }
  const parser = new SAXParser(SaxEventType.OpenTag | SaxEventType.CloseTag, { highWaterMark: 64 * 1024 });

  // Instantiate and prepare the wasm for parsing
  const ready = await parser.prepareWasm(new Uint8Array(await wasmResponse.arrayBuffer()));
  if (ready) {
    return parser;
  }
}

export async function createInterpolator(config: SVGInterpolatorConfig, saxWasmPath = './sax-wasm.wasm') {
  const parser = await getParser(saxWasmPath);
  return new SVGPathInterpolator({ ...config, parser });
}
