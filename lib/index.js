import { SaxEventType, SAXParser } from 'sax-wasm';
import { SVGPathInterpolator } from './SVGPathInterpolator.js';
export { SVGPathInterpolator } from './SVGPathInterpolator.js';
async function getParser(saxWasmSource) {
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
export async function createInterpolator(config, saxWasmSource) {
    const parser = await getParser(saxWasmSource);
    return new SVGPathInterpolator({ ...config, parser });
}
