import { SaxEventType, SAXParser } from 'sax-wasm';
import { SVGPathInterpolator } from './SVGPathInterpolator.js';
import type { SVGInterpolatorConfig } from './SVGPathInterpolator.js';

export { SVGPathInterpolator } from './SVGPathInterpolator.js';
export type { SVGInterpolatorConfig } from './SVGPathInterpolator.js';

/** A source for the WebAssembly parser required to process complete SVG documents. */
export type SaxWasmSource = string | URL | Uint8Array | Response;

async function getParser(saxWasmSource: SaxWasmSource) {
  const parser = new SAXParser(SaxEventType.OpenTag | SaxEventType.CloseTag);

  const response = typeof saxWasmSource === 'string' || saxWasmSource instanceof URL
    ? await fetch(saxWasmSource)
    : saxWasmSource;
  if (response instanceof Response && !response.ok) {
    throw new Error('Cannot load the SAX parser WASM');
  }
  const ready = await parser.prepareWasm(response);
  if (!ready) {
    throw new Error('Could not initialize the SAX parser');
  }
  return parser;
}

/**
 * Create an interpolator that can process complete SVG documents.
 *
 * Provide the SAX WebAssembly bytes, a URL, or a fetch `Response`. The package
 * does not bundle that binary, so callers choose how it is loaded.
 */
export async function createInterpolator(config: Omit<SVGInterpolatorConfig, 'parser'>, saxWasmSource: SaxWasmSource) {
  const parser = await getParser(saxWasmSource);
  return new SVGPathInterpolator({ ...config, parser });
}
