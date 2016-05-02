"use strict";
//https://pomax.github.io/bezierinfo/
const fs = require('fs');
const path = require('path');

const pathRegEx = /(?: d=")([\w.\-,\s]+)/g;
const commandRegEx = /(m|l|c|q|z)([\d+-.,]+)/ig;
const pointRegEx = /([-]?\d+\.*\d+)(?:,| )?([-]?\d+\.*\d+)/g;
const configPath = path.normalize(process.argv[2]);

let outputDirectory;
let trim;
let minDistance;
let roundToNearest;
let sampleFrequency;

function read(file) {
    return new Promise((resolve, reject) => {
        fs.access(file, fs.R_OK, (error)=> {
            if (error) {
                console.log(error);
                process.exit(1);
            }
            fs.readFile(file, 'utf8', (error, data)=> {
                if (data) {
                    resolve(data);
                }
                else {
                    reject(error);
                }
            });
        });
    });
}

function runJob(data) {
    const config = JSON.parse(data) || process.exit(1);
    const files = config.files || [];
    const len = files.length;
    if (len === 0) {
        console.log('No files specified.');
        process.exit(1);
    }
    trim = !!config.trim;
    minDistance = +config.minDistance || 0.5;
    roundToNearest = +config.roundToNearest || 0.25;
    sampleFrequency = +config.sampleFrequency || 0.001;
    outputDirectory = config.outputDirectory;

    if (outputDirectory) {
        try {
            fs.mkdirSync(outputDirectory);
        }
        catch (e) {
            // no-op - already there
        }
    }
    const promises = [];
    for (let i = ~~0; i < ~~len; i++) {
        const file = path.normalize(files[i]);
        const fileInfo = path.parse(files[i]);
        promises[i] = read(file).then(processPaths).then(interpolatedPaths => {
            const jsonStr = JSON.stringify(interpolatedPaths, 2);
            if (outputDirectory) {
                fs.writeFile(path.normalize(`${outputDirectory}/${fileInfo.name}.pathData.json`), jsonStr);
            }
            else {
                console.log(`{"${fileInfo.name}":${jsonStr}}`);
            }
        });
    }
}

function processPaths(data) {
    const interpolatedPaths = {};
    let i = ~~0;
    let result;

    while (result = pathRegEx.exec(data)) {
        const key = `path_${i}`;
        interpolatedPaths[key] = interpolatePath(result[0]);
        i++;
    }

    return Promise.resolve(interpolatedPaths);
}

function interpolatePath(path) {
    const data = [];
    let subPathStartX = 0;
    let subPathStartY = 0;
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
            case 'z':
            case 'Z':
                offsetX = subPathStartX;
                offsetY = subPathStartY;
                args = [offsetX, offsetY];
                calculator = calculateCoordinatesLinear;
                break;

            case 'm':
                offsetX += points[0];
                offsetY += points[1];
                break;

            case 'M':
                offsetX = points[0];
                offsetY = points[1];

                subPathStartX = offsetX;
                subPathStartY = offsetY;
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
            const len = ~~points.length;
            Array.prototype.push.apply(data, pts);
            offsetX += points[len - 1];
            offsetY += points[len - 2];
        }
    }
    if (trim) {
        trimPathOffsets(data);
    }
    return data;
}

function trimPathOffsets(paths) {
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
    const t2 = t * t;
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
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
            lastX = x;
            lastY = y;
        }
        t += sampleFrequency
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
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
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
        if (Math.abs(dist) > minDistance) {
            pts.push(x - (x % roundToNearest), y - (y % roundToNearest));
            lastX = x;
            lastY = y;
        }
        t += .001;
    }
    return pts;
}

read(configPath).then(runJob);
