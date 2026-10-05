import { SVGTransform } from './SVGTransform.js';
import { degToRads, isNullOrUndefined } from './utils.js';

export type Point = {
  x: number;
  y: number;
}

/**
 * Counts the work done while sampling one path or whole SVG document.
 *
 * The same budget object moves through every calculator, so limits still work
 * when an arc is split into several curves or a document has several paths.
 */
export interface SamplingBudget {
  /** Stop before trying more than this many sample positions. */
  maxSamples?: number;
  /** Stop before returning more than this many x/y point pairs. */
  maxOutputPoints?: number;
  /** Number of sample positions tried so far. */
  samples: number;
  /** Number of x/y point pairs returned so far. */
  outputPoints: number;
}

/** Count one sampling attempt and stop before it would exceed the configured limit. */
export function consumeSample(budget?: SamplingBudget) {
  if (!budget) {
    return;
  }
  if (budget.maxSamples !== undefined && budget.samples >= budget.maxSamples) {
    throw new RangeError(`maxSamples of ${budget.maxSamples} would be exceeded`);
  }
  budget.samples++;
}

/** Round and save one point, while enforcing the shared output limit. */
function addPoint(points: number[], x: number, y: number, roundToNearest: number, budget?: SamplingBudget) {
  if (budget?.maxOutputPoints !== undefined && budget.outputPoints >= budget.maxOutputPoints) {
    throw new RangeError(`maxOutputPoints of ${budget.maxOutputPoints} would be exceeded`);
  }
  points.push(x - (x % roundToNearest), y - (y % roundToNearest));
  if (budget) {
    budget.outputPoints++;
  }
}

/** Find one value between two values at position `t`, where 0 is the start and 1 is the end. */
function calculateLinear(t: number, p1: number, p2: number): number {
  return p1 + t * (p2 - p1);
}

/** Find one coordinate on a quadratic Bézier curve at position `t`. */
function calculatePointQuadratic(t: number, p1: number, p2: number, p3: number): number {
  const oneMinusT = 1 - t;
  return (oneMinusT * oneMinusT) * p1 + 2 * oneMinusT * t * p2 + (t * t) * p3;
}

/** Find one coordinate on a cubic Bézier curve at position `t`. */
function calculatePointCubic(t: number, p1: number, p2: number, p3: number, p4: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  const oneMinusT = 1 - t;

  // Calculate each Bernstein weight before multiplying by its coordinate.
  // This avoids overflowing a finite control point solely because it is first
  // multiplied by 3.
  return p1 * Math.pow(oneMinusT, 3)
    + p2 * (3 * oneMinusT * oneMinusT * t)
    + p3 * (3 * oneMinusT * t2)
    + p4 * t3;
}

/** Sample one or more straight line segments. */
function calculateCoordinatesLinear(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number, budget?: SamplingBudget): number[] {
  const pts: number[] = [];
  let [ startX, startY ] = points.splice(0, 2);

  for (let i = 0; i < points.length; i += 2) {
    let endX = points[i];
    let endY = points[i + 1];
    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
      consumeSample(budget);
      const x = calculateLinear(t, startX, endX);
      const y = calculateLinear(t, startY, endY);

      const deltaX = x - lastX;
      const deltaY = y - lastY;
      const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
      if (Math.abs(dist) > minDistance) {
        addPoint(pts, x, y, roundToNearest, budget);
        lastX = x;
        lastY = y;
      }
      t += sampleFrequency
    }
    startX = endX;
    startY = endY;
  }
  return pts;
}

/** Sample one or more quadratic Bézier curve segments. */
function calculateCoordinatesQuad(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number, budget?: SamplingBudget): number[] {
  const pts: number[] = [];
  let [ startX, startY ] = points.splice(0, 2);

  for (let i = 0; i < points.length; i += 4) {
    let ctrl1x = points[i];
    let ctrl1y = points[i + 1];
    let endX = points[i + 2];
    let endY = points[i + 3];

    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
      consumeSample(budget);
      const x = calculatePointQuadratic(t, startX, ctrl1x, endX);
      const y = calculatePointQuadratic(t, startY, ctrl1y, endY);

      const deltaX = x - lastX;
      const deltaY = y - lastY;
      const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
      if (Math.abs(dist) > minDistance) {
        addPoint(pts, x, y, roundToNearest, budget);
        lastX = x;
        lastY = y;
      }
      t += sampleFrequency;
    }
    startX = endX;
    startY = endY;
  }

  return pts;
}

/** Sample one or more cubic Bézier curve segments. */
function calculateCoordinatesCubic(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number, budget?: SamplingBudget): number[] {
  const pts: number[] = [];
  let [ startX, startY ] = points.splice(0, 2);

  for (let i = 0; i < points.length; i += 6) {
    let ctrl1x = points[i];
    let ctrl1y = points[i + 1];
    let ctrl2x = points[i + 2];
    let ctrl2y = points[i + 3];
    let endX = points[i + 4];
    let endY = points[i + 5];
    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
      consumeSample(budget);
      const x = calculatePointCubic(t, startX, ctrl1x, ctrl2x, endX);
      const y = calculatePointCubic(t, startY, ctrl1y, ctrl2y, endY);

      const deltaX = x - lastX;
      const deltaY = y - lastY;
      const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
      if (Math.abs(dist) > minDistance) {
        addPoint(pts, x, y, roundToNearest, budget);
        lastX = x;
        lastY = y;
      }
      t += sampleFrequency;
    }
    startX = endX;
    startY = endY;
  }

  return pts;
}

/**
 * Sample smooth cubic curves by reflecting the previous control point.
 *
 * SVG uses this rule for its `S` and `s` path commands.
 */
function calculateCoordinatesSmoothCubic(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number, budget?: SamplingBudget): number[] {
  const pts: number[] = [];
  let [ startX, startY, previousCtrl2x, previousCtrl2y ] = points.splice(0, 4);

  for (let i = 0; i < points.length; i += 4) {
    const ctrl2x = points[i];
    const ctrl2y = points[i + 1];
    const endX = points[i + 2];
    const endY = points[i + 3];
    if (isNullOrUndefined(previousCtrl2x) || isNullOrUndefined(previousCtrl2y)) {
      previousCtrl2x = startX;
      previousCtrl2y = startY;
    }

    let svgTransform = new SVGTransform(1, 0, 0, 1, previousCtrl2x - startX, previousCtrl2y - startY).inverse();
    let { x: ctrl1x, y: ctrl1y } = svgTransform.map(startX, startY);

    const interpolatedPts = calculateCoordinatesCubic([ startX, startY, ctrl1x, ctrl1y, ctrl2x, ctrl2y, endX, endY ], minDistance, roundToNearest, sampleFrequency, budget);
    pts.push(...interpolatedPts);

    startX = endX;
    startY = endY;
    previousCtrl2x = ctrl2x;
    previousCtrl2y = ctrl2y;
  }
  return pts;
}

/**
 * Sample SVG elliptical arcs.
 *
 * Each arc is changed into one or more cubic curves first, then sampled with
 * the same rules and shared budget as any other curve.
 */
function calculateCoordinatesArc(points: number[], minDistance: number, roundToNearest: number, sampleFrequency: number, budget?: SamplingBudget): number[] {
  const pts: number[] = [];
  let [ startX, startY ] = points.splice(0, 2);

  for (let i = 0; i < points.length; i += 7) {
    let rx = points[i];
    let ry = points[i + 1];
    let angle = points[i + 2];
    let largeArc = points[i + 3];
    let sweep = points[i + 4];
    let endX = points[i + 5];
    let endY = points[i + 6];
    // If the endpoints (x1, y1) and (x2, y2) are identical, then
    // this is equivalent to omitting the elliptical arc segment entirely.
    if (startX===endX && startY===endY) {
      continue;
    }
    // If rx = 0 or ry = 0 then this arc is treated as a straight
    // line segment (a "lineto") joining the endpoints.
    if (rx===0 || ry===0) {
      pts.push(...calculateCoordinatesLinear([ startX, startY, endX, endY ], minDistance, roundToNearest, sampleFrequency, budget));
      startX = endX;
      startY = endY;
      continue;
    }
    // If rx or ry have negative signs, these are dropped;
    // the absolute value is used instead.
    if (rx < 0) {
      rx *= -1;
    }
    if (ry < 0) {
      ry *= -1;
    }

    const beziers = decomposeArcToCubic({ x: startX, y: startY }, angle, rx, ry, largeArc, sweep, { x: endX, y: endY });
    // Triplet points - start of new bezier is end of last
    for (let i = 0; i < beziers.length; i += 3) {
      const ctrlPt1 = beziers[i];
      const ctrlPt2 = beziers[i + 1];
      const endPoint = beziers[i + 2];
      const points = [ startX, startY, ctrlPt1.x, ctrlPt1.y, ctrlPt2.x, ctrlPt2.y, endPoint.x, endPoint.y ];
      const interpolatedPoints = calculateCoordinatesCubic(points, minDistance, roundToNearest, sampleFrequency, budget);
      pts.push(...interpolatedPoints);

      startX = endPoint.x;
      startY = endPoint.y;
    }
    startX = endX;
    startY = endY;
  }

  return pts;
}

/**
 * Change an SVG arc into cubic Bézier control points.
 *
 * A cubic curve is easier for the rest of this module to sample consistently.
 */
function decomposeArcToCubic(point1: Point, rotationInDegrees: number, rx: number, ry: number, largeArcFlag: number, sweepFlag: number, point2: Point): [Point, Point, Point] | [] {
  // This follows SVG's endpoint-to-center conversion, then approximates each
  // quarter-or-smaller ellipse section with a cubic Bézier curve.
  const phi = degToRads(rotationInDegrees % 360);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  // Divide before subtracting so opposite finite coordinates near the limits
  // of a JavaScript number do not overflow while finding their midpoint delta.
  const halfDx = point1.x / 2 - point2.x / 2;
  const halfDy = point1.y / 2 - point2.y / 2;
  const x1p = cosPhi * halfDx + sinPhi * halfDy;
  const y1p = -sinPhi * halfDx + cosPhi * halfDy;

  const coordinateScale = Math.max(Math.abs(x1p), Math.abs(y1p));
  if (coordinateScale === 0) {
    return [];
  }

  // Keep the correction calculation close to one. Directly squaring very large
  // or very small radii can overflow or underflow even when the final ellipse
  // is representable.
  const normalizedX = x1p / coordinateScale;
  const normalizedY = y1p / coordinateScale;
  const radiusScale = Math.max(rx, ry);
  const normalizedRx = rx / radiusScale;
  const normalizedRy = ry / radiusScale;
  const radiusDistance = Math.hypot(
    normalizedX / normalizedRx,
    normalizedY / normalizedRy
  );
  if (radiusDistance > radiusScale / coordinateScale) {
    const correctedRx = coordinateScale * Math.hypot(
      normalizedX,
      normalizedY * (normalizedRx / normalizedRy)
    );
    const correctedRy = coordinateScale * Math.hypot(
      normalizedX * (normalizedRy / normalizedRx),
      normalizedY
    );
    if (!Number.isFinite(correctedRx) || !Number.isFinite(correctedRy)) {
      throw new RangeError('SVG arc cannot be represented with finite radii');
    }
    rx = correctedRx;
    ry = correctedRy;
  }

  const endpointDistance = Math.hypot(x1p / rx, y1p / ry);
  if (!Number.isFinite(endpointDistance) || endpointDistance === 0) {
    return [];
  }

  let centerFactor = Math.sqrt(Math.max(0, 1 - endpointDistance * endpointDistance)) / endpointDistance;
  if (largeArcFlag === sweepFlag) {
    centerFactor = -centerFactor;
  }

  const centerXp = centerFactor * ((rx / ry) * y1p);
  const centerYp = centerFactor * (-(ry / rx) * x1p);
  const startUnitX = (x1p - centerXp) / rx;
  const startUnitY = (y1p - centerYp) / ry;
  const endUnitX = (-x1p - centerXp) / rx;
  const endUnitY = (-y1p - centerYp) / ry;
  if (![centerXp, centerYp, startUnitX, startUnitY, endUnitX, endUnitY].every(Number.isFinite)) {
    throw new RangeError('SVG arc cannot be represented with finite coordinates');
  }
  let arcAngle = Math.atan2(
    startUnitX * endUnitY - startUnitY * endUnitX,
    startUnitX * endUnitX + startUnitY * endUnitY
  );
  if (sweepFlag && arcAngle < 0) {
    arcAngle += Math.PI * 2;
  } else if (!sweepFlag && arcAngle > 0) {
    arcAngle -= Math.PI * 2;
  }

  const segmentCount = Math.ceil(Math.abs(arcAngle) / (Math.PI / 2));
  if (!Number.isFinite(segmentCount) || segmentCount === 0) {
    return [];
  }

  const outputScale = Math.max(
    Math.abs(point1.x),
    Math.abs(point1.y),
    Math.abs(point2.x),
    Math.abs(point2.y),
    rx,
    ry
  );
  const mapToEllipse = (x: number, y: number): Point => ({
    // Do the addition in a common scale. This avoids an intermediate overflow
    // when a finite endpoint is the difference of two very large values.
    x: outputScale * (
      point1.x / outputScale
      + (rx / outputScale) * cosPhi * (x - startUnitX)
      - (ry / outputScale) * sinPhi * (y - startUnitY)
    ),
    y: outputScale * (
      point1.y / outputScale
      + (rx / outputScale) * sinPhi * (x - startUnitX)
      + (ry / outputScale) * cosPhi * (y - startUnitY)
    )
  });
  const cubicBeziers: Point[] = [];
  const segmentAngle = arcAngle / segmentCount;
  for (let index = 0; index < segmentCount; index++) {
    const startOffset = index * segmentAngle;
    const endOffset = startOffset + segmentAngle;
    const startCos = Math.cos(startOffset);
    const startSin = Math.sin(startOffset);
    const endCos = Math.cos(endOffset);
    const endSin = Math.sin(endOffset);
    const startX = startUnitX * startCos - startUnitY * startSin;
    const startY = startUnitX * startSin + startUnitY * startCos;
    const endX = startUnitX * endCos - startUnitY * endSin;
    const endY = startUnitX * endSin + startUnitY * endCos;
    const alpha = (4 / 3) * Math.tan(segmentAngle / 4);
    const targetPoint = index === segmentCount - 1
      ? point2
      : mapToEllipse(endX, endY);
    cubicBeziers.push(
      mapToEllipse(startX - alpha * startY, startY + alpha * startX),
      mapToEllipse(endX + alpha * endY, endY - alpha * endX),
      targetPoint
    );
  }
  return cubicBeziers as [Point, Point, Point];
}

/** Map SVG command letters to the sampler that understands their point layout. */
export const calculators = {
  a: calculateCoordinatesArc,
  c: calculateCoordinatesCubic,
  h: calculateCoordinatesLinear,
  l: calculateCoordinatesLinear,
  m: calculateCoordinatesLinear,
  q: calculateCoordinatesQuad,
  s: calculateCoordinatesSmoothCubic,
  v: calculateCoordinatesLinear,
  z: calculateCoordinatesLinear
};
