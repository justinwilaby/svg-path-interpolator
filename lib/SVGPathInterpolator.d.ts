import { SAXParser } from 'sax-wasm';
export interface SVGInterpolatorConfig {
    joinPathData?: boolean;
    minDistance?: number;
    roundToNearest?: number;
    sampleFrequency?: number;
    trim?: boolean;
    parser?: SAXParser;
}
export declare class SVGPathInterpolator {
    /**
     * When trim is true, paths that were translated
     * are normalized and will begin at 0,0.
     *
     * @var {boolean} trim
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    trim: boolean;
    /**
     * minDistance is the minimum distance between the
     * current and previous points when sampling.
     * If a sample results in a distance less than the
     * specified value, the point is discarded.
     *
     * @var {number} minDistance
     * @memberOf SVGPathInterpolator#
     * @default 0.5
     */
    minDistance: number;
    /**
     * roundToNearest is useful when snapping to fractional
     * pixel values. For example, if roundToNearest is .25,
     * a sample resulting in the point 2.343200092,4.6100923
     * will round to 2.25,4.5.
     *
     * @var {number} roundToNearest
     * @memberOf SVGPathInterpolator#
     * @default 0.25
     */
    roundToNearest: number;
    /**
     * sampleFrequency determines the increment of t when sampling.
     * If sampleFrequency is set to .001 , since t iterates from
     * 0 to 1, there will be 1000 points sampled per command
     * but only points that are greater than minDistance are captured.
     *
     * @var {number} sampleFrequency
     * @memberOf SVGPathInterpolator#
     * @default 0.001
     */
    sampleFrequency: number;
    /**
     * When true, pretty creates formatted json output.
     *
     * @var {boolean} pretty
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    pretty: boolean;
    /**
     * Then number of spaces to indent when pretty is true.
     *
     * @var {int} prettyIndent
     * @memberOf SVGPathInterpolator#
     * @default 0
     */
    prettyIndent: number;
    /**
     * Whether to join path data into a single flat array.
     *
     * @var {boolean} joinPathData
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    joinPathData: boolean;
    /**
     * The SaxWasm parser instance;
     * @var { SAXParser } parser
     * @memberOf SVGPathInterpolator#
     * @default null
     */
    parser?: SAXParser;
    constructor(config?: SVGInterpolatorConfig);
    parseArguments(source: string): number[];
    processSVG(data: Uint8Array): number[] | Record<string, number[]>;
    applyTransforms(transforms: Record<string, string>, points: number[]): void;
    interpolatePath(path: string): number[];
    trimPathOffsets(paths: number[]): void;
    applyOffset(offsetX: number, offsetY: number, coords?: number[], setLength?: number): number[];
}
