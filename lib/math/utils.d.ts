import type { Point } from './calculators.js';
export declare function degToRads(deg: number): number;
export declare function radToDeg(rad: number): number;
export declare function isNullOrUndefined(value: number): boolean;
/**
 * Rotates a point around the given origin
 * by the specified radians and returns the
 * rotated point.
 *
 * @param originX The x coordinate of the point to rotate around.
 * @param originY The y coordinate of the point to rotate around.
 * @param x The x coordinate of the point to be rotated.
 * @param y The y coordinate of the point to be rotated.
 * @param radiansX Radians to rotate along the x axis.
 * @param radiansY Radians to rotate along the y axis.
 *
 * @returns {Object} The point with the rotated coordinates.
 */
export declare function rotatePoint(originX: number, originY: number, x: number, y: number, radiansX: number, radiansY: number): Point;
