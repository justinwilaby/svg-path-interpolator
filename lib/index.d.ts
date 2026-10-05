import { SVGPathInterpolator } from './SVGPathInterpolator.js';
import type { SVGInterpolatorConfig } from './SVGPathInterpolator.js';
export { SVGPathInterpolator } from './SVGPathInterpolator.js';
export type { SVGInterpolatorConfig } from './SVGPathInterpolator.js';
export type SaxWasmSource = string | URL | Uint8Array | Response;
export declare function createInterpolator(config: Omit<SVGInterpolatorConfig, 'parser'>, saxWasmSource: SaxWasmSource): Promise<SVGPathInterpolator>;
