const rotatePoint = require('./utils').rotatePoint;
const degToRads = require('./utils').degToRads;
const isNullOrUndefined = require('./utils').isNullOrUndefined;
const SVGTransform = require('./SVGTransform');

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

function calculateCoordinatesLinear(points, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let [startX, startY] = points.splice(0, 2);

    for (let i = 0; i < points.length; i += 2) {
        let endX = points[i];
        let endY = points[i + 1];
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
        startX = endX;
        startY = endY;
    }
    return pts;
}

function calculateCoordinatesQuad(points, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let [startX, startY] = points.splice(0, 2);

    for (let i = 0; i < points.length; i += 4) {
        let ctrl1x = points[i];
        let ctrl1y = points[i + 1];
        let endX = points[i + 2];
        let endY = points[i + 3];

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
        startX = endX;
        startY = endY;
    }

    return pts;
}

function calculateCoordinatesCubic(points, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let [startX, startY] = points.splice(0, 2);

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
        startX = endX;
        startY = endY;
    }

    return pts;
}

function calculateCoordinatesSmoothCubic(points, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let [startX, startY, previousCtrl2x, previousCtrl2y] = points.splice(0, 4);

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
        let {x:ctrl1x, y:ctrl1y} = svgTransform.map(startX, startY);

        const interpolatedPts = calculateCoordinatesCubic([startX, startY, ctrl1x, ctrl1y, ctrl2x, ctrl2y, endX, endY], minDistance, roundToNearest, sampleFrequency, 6);
        pts.push(...interpolatedPts);

        startX = endX;
        startY = endY;
        previousCtrl2x = ctrl2x;
        previousCtrl2y = ctrl2y;
    }
    return pts;
}

function calculateCoordinatesArc(points, minDistance, roundToNearest, sampleFrequency) {
    const pts = [];
    let [startX, startY] = points.splice(0, 2);

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
        if (startX === endX && startY === endY) {
            continue;
        }
        // If rx = 0 or ry = 0 then this arc is treated as a straight
        // line segment (a "lineto") joining the endpoints.
        if (rx === 0 || ry === 0) {
            pts.push(...calculateCoordinatesLinear([startX, startY, endX, endY], minDistance, roundToNearest, sampleFrequency));
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

        const beziers = decomposeArcToCubic({x: startX, y: startY}, angle, rx, ry, largeArc, sweep, {x: endX, y: endY});
        // Triplet points - start of new bezier is end of last
        for (let i = 0; i < beziers.length; i += 3) {
            const ctrlPt1 = beziers[i];
            const ctrlPt2 = beziers[i + 1];
            const endPoint = beziers[i + 2];
            const points = [startX, startY, ctrlPt1.x, ctrlPt1.y, ctrlPt2.x, ctrlPt2.y, endPoint.x, endPoint.y];
            const interpolatedPoints = calculateCoordinatesCubic(points, minDistance, roundToNearest, sampleFrequency);
            pts.push(...interpolatedPoints);

            startX = endPoint.x;
            startY = endPoint.y;
        }
        startX = endX;
        startY = endY;
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

module.exports = {
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