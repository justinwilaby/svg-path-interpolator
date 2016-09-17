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

function calculateCoordinatesQuad(startX, startY, ctrl1x, ctrl1y, endX, endY, minDistance, roundToNearest, sampleFrequency) {
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
        t += sampleFrequency;
    }
    return pts;
}

function calculateCoordinatesCubic(startX, startY, ctrl1x, ctrl1y, ctrl2x, ctrl2y, endX, endY, minDistance, roundToNearest, sampleFrequency) {
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
        t += sampleFrequency;
    }
    return pts;
}

function calculateCoordinatesArc(startX, startY, rx, ry, angle, largeArc, sweep, endX, endY, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    // If the endpoints (x1, y1) and (x2, y2) are identical, then
    // this is equivalent to omitting the elliptical arc segment entirely.
    if (startX === endX && startY === endY) {
        return pts;
    }
    // If rx = 0 or ry = 0 then this arc is treated as a straight
    // line segment (a "lineto") joining the endpoints.
    if (rx === 0 || ry === 0) {
        return calculateCoordinatesLinear(startX, startY, endX, endY, minDistance, roundToNearest, sampleFrequency);
    }
    // If rx or ry have negative signs, these are dropped;
    // the absolute value is used instead.
    if (rx < 0) {
        rx *= -1;
    }
    if (ry < 0) {
        ry *= -1;
    }

    const beziers = decomposeArcToCubic({x: startX, y: startY}, angle, rx, ry, largeArc, sweep, {x: endX, y: endY});
    // Triplet points - start of new bezier is end of last
    for (let i = 0; i < beziers.length; i += 3) {
        const ctrlPt1 = beziers[i];
        const ctrlPt2 = beziers[i + 1];
        const endPoint = beziers[i + 2];
        const interpolatedPoints = calculateCoordinatesCubic(startX, startY, ctrlPt1.x, ctrlPt1.y, ctrlPt2.x, ctrlPt2.y, endPoint.x, endPoint.y, minDistance, roundToNearest, sampleFrequency);
        pts.push(...interpolatedPoints);

        startX = endPoint.x;
        startY = endPoint.y;
    }
    return pts;
}

function decomposeArcToCubic(point1, rotationInDegrees, rx, ry, largeArcFlag, sweepFlag, point2) {
    //----------------------------
    // https://github.com/WebKit/webkit/blob/master/Source/WebCore/svg/SVGPathParser.cpp
    //----------------------------
    // Conversion from endpoint to center parameterization
    // https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
    const angleRads = degToRads(rotationInDegrees);
    const midPointDistance = {x: (point1.x - point2.x) * .5, y: (point1.y - point2.y) * .5};
    const transformedMidPoint = rotatePoint(0, 0, midPointDistance.x, midPointDistance.y, -angleRads, -angleRads);
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
    point1 = rotatePoint(0, 0, point1.x, point1.y, -angleRads, -angleRads);
    point2 = rotatePoint(0, 0, point2.x, point2.y, -angleRads, -angleRads);

    const delta = {x: point2.x - point1.x, y: point2.y - point1.y};
    const d = delta.x * delta.x + delta.y * delta.y;
    const scaleFactorSquared = Math.max(1 / d - 0.25, 0);
    let scaleFactor = Math.sqrt(scaleFactorSquared);
    if (sweepFlag === largeArcFlag) {
        scaleFactor = -scaleFactor;
    }
    delta.x *= scaleFactor;
    delta.y *= scaleFactor;
    let centerPoint = {x: (point1.x + point2.x) * .5, y: (point1.y + point2.y) * .5};
    // https://github.com/WebKit/webkit/blob/master/Source/WebCore/svg/SVGPathParser.cpp#L465
    centerPoint.x -= delta.y;
    centerPoint.y += delta.x;

    const theta1 = Math.atan2(point1.y - centerPoint.y, point1.x - centerPoint.x);
    const theta2 = Math.atan2(point2.y - centerPoint.y, point2.x - centerPoint.x);

    let thetaArc = theta2 - theta1;
    if (thetaArc < 0 && sweepFlag)
        thetaArc += 2 * Math.PI;
    else if (thetaArc > 0 && !sweepFlag)
        thetaArc -= 2 * Math.PI;

    // Some results of atan2 on some platform implementations are not exact enough. So that we get more
    // cubic curves than expected here. Adding 0.001f reduces the count of segments to the correct count.
    const cubicBeziers = []; // Triplet points - Assumes the start point is the end point from the previous command
    const segments = Math.ceil(Math.abs(thetaArc / ((Math.PI / 2) + 0.001)));
    for (let i = 0; i < segments; i++) {
        const startTheta = theta1 + i * thetaArc / segments;
        const endTheta = theta1 + (i + 1) * thetaArc / segments;
        const t = (8 / 6) * Math.tan(0.25 * (endTheta - startTheta));
        if (!isFinite(t)) {
            return cubicBeziers;
        }
        const sinStartTheta = Math.sin(startTheta);
        const cosStartTheta = Math.cos(startTheta);
        const sinEndTheta = Math.sin(endTheta);
        const cosEndTheta = Math.cos(endTheta);

        point1 = {x: cosStartTheta - t * sinStartTheta, y: sinStartTheta + t * cosStartTheta};
        point1.x += centerPoint.x;
        point1.y += centerPoint.y;

        let targetPoint = {x: cosEndTheta, y: sinEndTheta};
        targetPoint.x += centerPoint.x;
        targetPoint.y += centerPoint.y;

        point2 = Object.assign({}, targetPoint);
        point2.x += t * sinEndTheta;
        point2.y += -t * cosEndTheta;

        // rotate and scale
        point1 = rotatePoint(0, 0, point1.x, point1.y, angleRads, angleRads);
        point1.x *= rx;
        point1.y *= ry;

        point2 = rotatePoint(0, 0, point2.x, point2.y, angleRads, angleRads);
        point2.x *= rx;
        point2.y *= ry;

        targetPoint = rotatePoint(0, 0, targetPoint.x, targetPoint.y, angleRads, angleRads);
        targetPoint.x *= rx;
        targetPoint.y *= ry;

        cubicBeziers.push(point1, point2, targetPoint);
    }
    return cubicBeziers;
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

function degToRads(deg){
    return Math.PI * deg / 180;
}

module.exports = {
    calculateCoordinatesArc,
    calculateCoordinatesCubic,
    calculateCoordinatesLinear,
    calculateCoordinatesQuad
};