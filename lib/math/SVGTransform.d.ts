import type { Point } from './calculators.js';
export declare class SVGTransform {
    protected m_transform: number[];
    constructor(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number);
    makeIdentity(): void;
    setMatrix(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number): void;
    matrix(a?: number, b?: number, c?: number, d?: number, e?: number, f?: number): void;
    isIdentity(): boolean;
    static det(transform: number[]): number;
    get xScale(): number;
    get yScale(): number;
    get isInvertible(): boolean;
    inverse(): SVGTransform;
    isIdentityOrTranslation(): boolean;
    multiply(other: SVGTransform): this;
    rotate(degrees: number, x: number, y: number): this;
    scale(sx: number, sy: number): this;
    translate(tx: number, ty: number): this;
    rotateFromVector(x: number, y: number): this;
    flipX(): this;
    flipY(): this;
    shear(sx: number, sy: number): this;
    skew(angleX: number, angleY: number): this;
    skewX(angle: number): this;
    skewY(angle: number): this;
    map(x: number, y: number): {
        x: number;
        y: number;
    };
    mapPoint(point: Point): {
        x: number;
        y: number;
    };
}
