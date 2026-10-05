import assert from 'node:assert/strict';
import test from 'node:test';
import { SVGTransform } from '../lib/math/SVGTransform.js';

const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} is not close to ${expected}`);
const pointIs = (point, x, y) => {
  closeTo(point.x, x);
  closeTo(point.y, y);
};

test('maps points with SVG matrix values and resets to identity', () => {
  const transform = new SVGTransform(2, 3, 5, 7, 11, 13);
  pointIs(transform.map(17, 19), 140, 197);
  pointIs(transform.mapPoint({ x: 1, y: 2 }), 23, 30);
  assert.equal(transform.xScale, Math.hypot(2, 3));
  assert.equal(transform.yScale, Math.hypot(5, 7));
  assert.equal(SVGTransform.det([2, 3, 5, 7, 11, 13]), -1);
  transform.makeIdentity();
  assert.equal(transform.isIdentity(), true);
});

test('composes transforms in SVG order', () => {
  const transform = new SVGTransform().translate(10, 5).scale(2, 3);
  pointIs(transform.map(1, 1), 12, 8);
  const combined = new SVGTransform().translate(10, 0);
  combined.multiply(new SVGTransform().scale(2));
  pointIs(combined.map(5, 0), 20, 0);
});

test('inverts ordinary and translation matrices', () => {
  const transform = new SVGTransform().translate(10, -4).rotate(30).scale(2, 3);
  const original = { x: 7, y: -2 };
  pointIs(transform.inverse().mapPoint(transform.mapPoint(original)), original.x, original.y);
  const translation = new SVGTransform().translate(4, -9);
  assert.equal(translation.isIdentityOrTranslation(), true);
  pointIs(translation.inverse().map(4, -9), 0, 0);
});

test('rotates around a supplied center', () => {
  const transform = new SVGTransform().rotate(90, 10, 20);
  pointIs(transform.map(11, 20), 10, 21);
  pointIs(transform.map(10, 20), 10, 20);
});

test('supports scale, skew, shear, flips, and vector rotation helpers', () => {
  pointIs(new SVGTransform().scale(2).map(3, 4), 6, 8);
  pointIs(new SVGTransform().skewX(45).map(2, 3), 5, 3);
  pointIs(new SVGTransform().skewY(45).map(2, 3), 2, 5);
  pointIs(new SVGTransform().shear(2, 3).map(1, 1), 3, 4);
  pointIs(new SVGTransform().flipX().flipY().map(2, -3), -2, 3);
  pointIs(new SVGTransform().rotateFromVector(0, 1).map(1, 1), 0, 2);
});

test('reports non-invertible matrices', () => {
  const transform = new SVGTransform().scale(0, 1);
  assert.equal(transform.isInvertible, false);
  assert.equal(transform.isIdentityOrTranslation(), false);
});
