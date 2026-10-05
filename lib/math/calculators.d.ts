export type Point = {
    x: number;
    y: number;
};
declare function calculateCoordinatesLinear(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number): number[];
declare function calculateCoordinatesQuad(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number): number[];
declare function calculateCoordinatesCubic(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number): number[];
declare function calculateCoordinatesSmoothCubic(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number): number[];
declare function calculateCoordinatesArc(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number): number[];
export declare const calculators: {
    a: typeof calculateCoordinatesArc;
    c: typeof calculateCoordinatesCubic;
    h: typeof calculateCoordinatesLinear;
    l: typeof calculateCoordinatesLinear;
    m: typeof calculateCoordinatesLinear;
    q: typeof calculateCoordinatesQuad;
    s: typeof calculateCoordinatesSmoothCubic;
    v: typeof calculateCoordinatesLinear;
    z: typeof calculateCoordinatesLinear;
};
export {};
