import type { Point } from './calculators.js';

export function degToRads(deg: number): number {
  return Math.PI * deg / 180;
}

export function radToDeg(rad: number): number {
  return rad * 180 / Math.PI;
}

export function isNullOrUndefined(value: number): boolean {
  return Boolean(value===undefined || value===null);
}

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
export function rotatePoint(originX: number, originY: number, x: number, y: number, radiansX: number, radiansY: number): Point {
  const v = { x: x - originX, y: y - originY };
  const vx = (v.x * Math.cos(radiansX)) - (v.y * Math.sin(radiansX));
  const vy = (v.x * Math.sin(radiansY)) + (v.y * Math.cos(radiansY));
  return { x: vx + originX, y: vy + originY };
}
