// Calculators
// https://pomax.github.io/bezierinfo/
function calculateLinear(t, p1, p2) {
    return p1 + t * (p2 - p1);
}

function calculatePointQuadratic(t, p1, p2, p3) {
    const oneMinusT = 1 - t;
    return (oneMinusT * oneMinusT) * p1 + 2 * oneMinusT * t * p2 + (t * t) * p3;
}

function calculatePointCubic(t, p1, p2, p3, p4) {
    const t2 = t * t;
    const t3 = t2 * t;
    const oneMinusT = 1 - t;

    return p1 * Math.pow(oneMinusT, 3) + p2 * 3 * (oneMinusT * oneMinusT) * t + p3 * 3 * oneMinusT * t2 + p4 * t3;
}

function calculateCoordinatesLinear(startX, startY, endX, endY, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
        const x = calculateLinear(t, startX, endX);
        const y = calculateLinear(t, startY, endY);

        const deltaX = x - lastX;
        const deltaY = y - lastY;
        const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
            lastX = x;
            lastY = y;
        }
        t += sampleFrequency
    }
    return pts;
}

function calculateCoordinatesQuad(startX, startY, ctrl1x, ctrl1y, endX, endY, minDistance, roundToNearest) {
    const pts = [];
    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
        const x = calculatePointQuadratic(t, startX, ctrl1x, endX);
        const y = calculatePointQuadratic(t, startY, ctrl1y, endY);

        const deltaX = x - lastX;
        const deltaY = y - lastY;
        const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}

function calculateCoordinatesCubic(startX, startY, ctrl1x, ctrl1y, ctrl2x, ctrl2y, endX, endY, minDistance, roundToNearest) {
    const pts = [];
    let t = 0;
    let lastX = startX;
    let lastY = startY;
    while (t <= 1.0000000000000007) {
        const x = calculatePointCubic(t, startX, ctrl1x, ctrl2x, endX);
        const y = calculatePointCubic(t, startY, ctrl1y, ctrl2y, endY);

        const deltaX = x - lastX;
        const deltaY = y - lastY;
        const dist = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}

function decomposeArcToCubic(rotationInDegrees, rx, ry, largeArcFlag, sweepFlag, point1, point2) {
    //----------------------------
    // https://github.com/WebKit/webkit/blob/master/Source/WebCore/svg/SVGPathParser.cpp
    //----------------------------
    // Conversion from endpoint to center parameterization
    // https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
    const midPointDistance = {x: (point1.x - point2.x) * .5, y: (point1.y - point2.y) * .5};
    const rotationInRadians = Math.PI * rotationInDegrees / 180;
    const transformedMidPoint = rotatePoint(0, 0, midPointDistance.x, midPointDistance.y, -rotationInRadians, -rotationInRadians);
    const squareRx = rx * rx;
    const squareRy = ry * ry;
    const squareX = transformedMidPoint.x * transformedMidPoint.x;
    const squareY = transformedMidPoint.y * transformedMidPoint.y;

    // Check if the radii are big enough to draw the arc, scale radii if not.
    // http://www.w3.org/TR/SVG/implnote.html#ArcCorrectionOutOfRangeRadii
    const radiiScale = squareX / squareRx + squareY / squareRy;
    if (radiiScale > 1) {
        const sqrtRadiiScale = Math.sqrt(radiiScale);
        rx *= sqrtRadiiScale;
        ry *= sqrtRadiiScale;
    }
    // Apply scale
    point1 = {x: point1.x * (1 / rx), y: point1.y * (1 / ry)};
    point2 = {x: point2.x * (1 / rx), y: point2.y * (1 / ry)};
    // Apply rotation
    point1 = rotatePoint(0, 0, point1.x, point1.y, -rotationInRadians, -rotationInRadians);
    point2 = rotatePoint(0, 0, point2.x, point2.y, -rotationInRadians, -rotationInRadians);

    const delta = {x: point2.x - point1.x, y: point2.y - point1.y};
    const d = delta.x * delta.x + delta.y * delta.y;
    const scaleFactorSquared = Math.max(1 / d - 0.25, 0);
    let scaleFactor = Math.sqrt(scaleFactorSquared);
    if (sweepFlag == largeArcFlag) {
        scaleFactor = -scaleFactor;
    }
    delta.x *= scaleFactor;
    delta.y *= scaleFactor;
    let centerPoint = {x: (point1.x + point2.x) * .5, y: (point1.y + point2.y) * .5};
    // https://github.com/WebKit/webkit/blob/master/Source/WebCore/svg/SVGPathParser.cpp#L465
    centerPoint.x -= delta.y;
    centerPoint.y += delta.x;
    //m_x * m_x + m_y * m_y;
    const theta1 = Math.pow(point1.x - centerPoint.x, 2) + Math.pow(point1.y - centerPoint.y, 2);
    const theta1 = Math.pow(point2.x - centerPoint.x, 2) + Math.pow(point2.y - centerPoint.y, 2);

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
function rotatePoint(originX, originY, x, y, radiansX, radiansY) {
    const v = {x: x - originX, y: y - originY};
    const vx = (v.x * Math.cos(radiansX)) - (v.y * Math.sin(radiansX));
    const vy = (v.x * Math.sin(radiansY)) + (v.y * Math.cos(radiansY));
    return {x: vx + originX, y: vy + originY};
}

module.exports = {
    calculateLinear,
    calculatePointQuadratic,
    calculatePointCubic,
    calculateCoordinatesLinear,
    calculateCoordinatesQuad,
    calculateCoordinatesCubic
};