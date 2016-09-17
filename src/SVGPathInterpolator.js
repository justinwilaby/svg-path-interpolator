"use strict";
const calculators = require('./calculators');

const pathRegEx = /(?: d=")([\w.\-,\s]+)/g;
const commandRegEx = /(m|l|c|q|z|a|v|h)(?: ?)([\d+-., ]+)/ig;
const pointRegEx = /([-]?\d+\.*\d*)(?:,| )?/g;

let _config;

function processPaths(data) {
    const interpolatedPaths = {};
    let i = ~~0;
    let result;

    while (result = pathRegEx.exec(data)) {
        const key = `path_${i++}`;
        interpolatedPaths[key] = interpolatePath(result[0]);
    }

    return interpolatedPaths;
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
            points.push(+point[1]);
        }

        switch (code) {
            case 'A':
                points.unshift(offsetX, offsetY);
                args = points;
                calculator = calculators.calculateCoordinatesArc;
                break;

            case 'a':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesArc;
                break;

            case 'c':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesCubic;
                break;

            case 'C':
                points.unshift(offsetX, offsetY);
                args = points;
                calculator = calculators.calculateCoordinatesCubic;
                break;

            case 'H':
                points.unshift(offsetX, offsetY);
                points.push(offsetY);
                args = points;
                calculator = calculators.calculateCoordinatesLinear;
                break;

            case 'h':
                points.unshift(0, 0);
                points.push(0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesLinear;
                break;

            case 'l':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesLinear;
                break;

            case 'L':
                points.unshift(offsetX, offsetY);
                args = points;
                calculator = calculators.calculateCoordinatesLinear;
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

            case 'q':
                points.unshift(0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesQuad;
                break;

            case 'V':
                points.unshift(offsetX, offsetY, offsetX);
                args = points;
                calculator = calculators.calculateCoordinatesLinear;
                break;

            case 'v':
                points.unshift(0, 0, 0);
                args = applyOffset(offsetX, offsetY, points);
                calculator = calculators.calculateCoordinatesLinear;
                break;

            case 'z':
            case 'Z':
                offsetX = subPathStartX;
                offsetY = subPathStartY;
                args = [offsetX, offsetY];
                calculator = calculators.calculateCoordinatesLinear;
                break;
        }

        if (calculator) {
            const {minDistance, roundToNearest, sampleFrequency} = _config;
            args.push(minDistance, roundToNearest, sampleFrequency);
            const pts = calculator(...args);
            const len = ~~points.length;
            data.push(...pts);
            offsetY += points[len - 1];
            offsetX += points[len - 2];
        }
    }
    if (_config.trim) {
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
    if (!i) {
        return;
    }
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
module.exports = class SVGPathInterpolator {
    /**
     * When trim is true, paths that were translated
     * are normalized and will begin at 0,0.
     *
     * @var {boolean} trim
     * @memberOf SVGPathInterpolator#
     * @default false
     */

    /**
     * minDistance is the minimum distance between the
     * current and previous points when sampling.
     * If a sample results in a distance less than the
     * specified value, the point is discarded.
     *
     * @var {number} minDistance
     * @memberOf SVGPathInterpolator#
     * @default 0.5
     */

    /**
     * roundToNearest is useful when snapping to fractional
     * pixel values. For example, if roundToNearest is .25,
     * a sample resulting in the point 2.343200092,4.6100923
     * will round to 2.25,4.5.
     *
     * @var {number} roundToNearest
     * @memberOf SVGPathInterpolator#
     * @default 0.25
     */

    /**
     * sampleFrequency determines the increment of t when sampling.
     * If sampleFrequency is set to .001 , since t iterates from
     * 0 to 1, there will be 1000 points sampled per command
     * but only points that are greater than minDistance are captured.
     *
     * @var {number} sampleFrequency
     * @memberOf SVGPathInterpolator#
     * @default 0.001
     */

    /**
     * When true, pretty creates formatted json output.
     *
     * @var {boolean} pretty
     * @memberOf SVGPathInterpolator#
     * @default false
     */

    /**
     * Then number of spaces to indent when pretty is true.
     *
     * @var {int} prettyIndent
     * @memberOf SVGPathInterpolator#
     * @default 0
     */

    constructor(config = {
        trim: true,
        minDistance: +0.5,
        roundToNearest: +0.25,
        sampleFrequency: +0.001,
        pretty: false,
        prettyIndent: ~~0
    }) {
        Object.assign(this, config);
    }

    processSvg(svg) {
        _config = {
            trim: this.trim,
            minDistance: this.minDistance,
            roundToNearest: this.roundToNearest,
            sampleFrequency: this.sampleFrequency
        };
        return processPaths(svg);
    }
};