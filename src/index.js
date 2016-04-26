"use strict";
//https://pomax.github.io/bezierinfo/
const fs = require('fs');

const pathRegEx = /(?: d=")([\w.\-,\s]+)/g;
const commandRegEx = /(m|l|c|q)([\d+-.,]+)/ig;
const pointRegEx = /([-]?\d+\.\d+)(?:,)?([-]?\d+\.\d+)/g;

fs.readFile('assets/StrideGuide.svg', 'utf8', (error, data)=> {

    const path = pathRegEx.exec(data)[1];
    const paths = [];
    let offsetX = 0;
    let offsetY = 0;
    let args;
    let calculator;
    let match;
    while (match = commandRegEx.exec(path)) {
        let code = match[1];
        let points = [];
        let point;
        while (point = pointRegEx.exec(match[2])) {
            points.push(+point[1], +point[2]);
        }

        switch (code) {
            case 'm':
                offsetX += points[0];
                offsetY += points[1];
                break;

            case 'M':
                offsetX = points[0];
                offsetY = points[1];
                break;

            case 'c':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculateCoordinatesCubic;
                break;

            case 'C':
                points.unshift(offsetX, offsetY);
                args = points;
                calculator = calculateCoordinatesCubic;
                break;

            case 'l':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculateCoordinatesLinear;
                break;

            case 'L':
                points.unshift(offsetX, offsetY);
                args = points;
                calculator = calculateCoordinatesLinear;
                break;

            case 'q':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculateCoordinatesQuad;
                break;
        }

        if (calculator) {
            const pts = calculator.apply(null, args);
            Array.prototype.push.apply(paths, pts);
            offsetX += points[points.length - 1];
            offsetY += points[points.length - 2];
        }
    }
    normalizePaths(paths);
    fs.writeFile('out.json', JSON.stringify({paths: paths}));
});

function normalizePaths(paths) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let i = paths.length;
    let x;
    let y;
    while (i -= 2) {
        x = paths[i];
        y = paths[i - 1];
        if (x < minX) {
            minX = x;
        }
        if (y < minY) {
            minY = y;
        }
    }

    i = paths.length;
    while (i -= 2) {
        paths[i] -= minX;
        paths[i - 1] -= minY;
    }
}

function applyOffset(offsetX, offsetY, coords) {
    return coords.map((value, index) => {
        return value + (index % 2 ? offsetY : offsetX);
    });
}

function calculateLinear(t, p1, p2) {
    return p1 + t * (p2 - p1);
}

function calculatePointQuadratic(t, p1, p2, p3) {
    const oneMinusT = 1 - t;
    return (oneMinusT * oneMinusT) * p1 + 2 * oneMinusT * t * p2 + (t * t) * p3;
}

function calculatePointCubic(t, p1, p2, p3, p4) {
    const t2 = Math.pow(t, 2);
    const t3 = t2 * t;
    const oneMinusT = 1 - t;

    return p1 * Math.pow(oneMinusT, 3) + p2 * 3 * (oneMinusT * oneMinusT) * t + p3 * 3 * oneMinusT * t2 + p4 * t3;
}

function calculateCoordinatesLinear(startX, startY, endX, endY) {
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
        if (Math.abs(dist) > .5) {
            pts.push(x - (x % .25), y - (y % .25));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}

function calculateCoordinatesQuad(startX, startY, ctrl1x, ctrl1y, endX, endY) {
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
        if (Math.abs(dist) > .5) {
            pts.push(x - (x % .25), y - (y % .25));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}

function calculateCoordinatesCubic(startX, startY, ctrl1x, ctrl1y, ctrl2x, ctrl2y, endX, endY) {
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
        if (Math.abs(dist) > .5) {
            pts.push(x - (x % .25), y - (y % .25));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}
