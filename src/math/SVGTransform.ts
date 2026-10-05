import { degToRads, radToDeg } from './utils.js';
import type { Point } from './calculators.js';

/**
 * A mutable 2D affine transform using SVG's six matrix values.
 *
 * Points are mapped with `x' = ax + cy + e` and `y' = bx + dy + f`.
 * Each transform method appends its operation to the current matrix.
 */
export class SVGTransform {
  protected m_transform: number[];

  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.m_transform = [Number(a), Number(b), Number(c), Number(d), Number(e), Number(f)];
  }

  makeIdentity() {
    this.setMatrix();
  }

  setMatrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.m_transform[0] = Number(a);
    this.m_transform[1] = Number(b);
    this.m_transform[2] = Number(c);
    this.m_transform[3] = Number(d);
    this.m_transform[4] = Number(e);
    this.m_transform[5] = Number(f);
  }

  matrix(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    this.setMatrix(a, b, c, d, e, f);
  }

  isIdentity() {
    const [a, b, c, d, e, f] = this.m_transform;
    return a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0;
  }

  static det(transform: number[]) {
    return transform[0] * transform[3] - transform[1] * transform[2];
  }

  get xScale() {
    const [a, b] = this.m_transform;
    return Math.hypot(a, b);
  }

  get yScale() {
    const [, , c, d] = this.m_transform;
    return Math.hypot(c, d);
  }

  get isInvertible() {
    const determinant = SVGTransform.det(this.m_transform);
    return determinant !== 0 && Number.isFinite(determinant);
  }

  inverse() {
    const [a, b, c, d, e, f] = this.m_transform;
    const determinant = SVGTransform.det(this.m_transform);

    if (this.isIdentityOrTranslation()) {
      return new SVGTransform(1, 0, 0, 1, -e, -f);
    }

    return new SVGTransform(
      d / determinant,
      -b / determinant,
      -c / determinant,
      a / determinant,
      (c * f - d * e) / determinant,
      (b * e - a * f) / determinant
    );
  }

  isIdentityOrTranslation() {
    const [a, b, c, d] = this.m_transform;
    return a === 1 && b === 0 && c === 0 && d === 1;
  }

  /** Append another transform to this matrix. */
  multiply(other: SVGTransform) {
    const [a, b, c, d, e, f] = this.m_transform;
    const [oa, ob, oc, od, oe, of] = other.m_transform;
    this.m_transform = [
      a * oa + c * ob,
      b * oa + d * ob,
      a * oc + c * od,
      b * oc + d * od,
      a * oe + c * of + e,
      b * oe + d * of + f
    ];
    return this;
  }

  rotate(degrees: number, x?: number, y?: number) {
    if (x !== undefined && y !== undefined) {
      this.translate(x, y);
    }
    const radians = degToRads(degrees);
    this.multiply(new SVGTransform(Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians)));
    if (x !== undefined && y !== undefined) {
      this.translate(-x, -y);
    }
    return this;
  }

  scale(sx: number, sy = sx) {
    return this.multiply(new SVGTransform(sx, 0, 0, sy));
  }

  translate(tx: number, ty = 0) {
    return this.multiply(new SVGTransform(1, 0, 0, 1, tx, ty));
  }

  rotateFromVector(x: number, y: number) {
    return this.rotate(radToDeg(Math.atan2(y, x)), x, y);
  }

  flipX() {
    return this.scale(-1, 1);
  }

  flipY() {
    return this.scale(1, -1);
  }

  shear(sx: number, sy: number) {
    return this.multiply(new SVGTransform(1, sy, sx, 1));
  }

  skew(angleX: number, angleY: number) {
    return this.shear(Math.tan(degToRads(angleX)), Math.tan(degToRads(angleY)));
  }

  skewX(angle: number) {
    return this.shear(Math.tan(degToRads(angle)), 0);
  }

  skewY(angle: number) {
    return this.shear(0, Math.tan(degToRads(angle)));
  }

  map(x: number, y: number) {
    const [a, b, c, d, e, f] = this.m_transform;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }

  mapPoint(point: Point) {
    return this.map(point.x, point.y);
  }
}
