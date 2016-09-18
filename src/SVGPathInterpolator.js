"use strict";
const parser = require('sax').parser(true);
const calculators = require('./math/calculators');
const SVGTransform = require('./math/SVGTransform');

const commandRegEx = /(m|l|c|q|z|a|v|h)(?: ?)([\d+-., ]+)/ig;
const argumentsRegEx = /([-]?\d+\.*\d*)(?:,| )?/g;
const transformRegEx = /(matrix|translate|scale|rotate|skewX|skewY)(?:\()(.*)(?:\))/;

let _config;

function parseArguments(source) {
    const args = [];
    let arg;
    while (arg = argumentsRegEx.exec(source)) {
        isFinite(arg[1]) ? arg[1] = +arg[1] : '' + arg[1];
        args.push(+arg[1]);
    }
    return args;
}

function processSVG(data) {
    // const interpolatedPaths = {};
    const interpolatedPaths = [];
    const openTagsDepth = {};
    const transforms = {};
    let i = 0;

    parser.onopentag = node => {
        if (!openTagsDepth[node.name]) {
            openTagsDepth[node.name] = 0;
        }
        const depth = openTagsDepth[node.name]++;
        if (node.attributes.transform) {
            transforms[depth + node.name] = node.attributes.transform;
        }

        if (node.name === 'path') {
            let key = `path_${i++}`;
            if (Object.keys(transforms).length) {
                key += 'transformed'
            }
            const points = interpolatePath(node.attributes.d);
            applyTransforms(transforms, points);
            // interpolatedPaths[key] = points;
            interpolatedPaths.push(...points);
        }
    };

    parser.onclosetag = node => {
        const depth = --openTagsDepth[node];
        delete transforms[depth + node];
    };
    parser.write(data).close();
    return interpolatedPaths;
}

function applyTransforms(transforms, points) {
    const keys = Object.keys(transforms);
    if (!keys.length) {
        return;
    }
    if (keys.length < 1) {
        keys.sort().reverse();
    }
    keys.forEach(depth => {
        const svgTransform = new SVGTransform();
        const rawTransform = transforms[depth];
        const [, type, rawArguments] = transformRegEx.exec(rawTransform);
        const args = parseArguments(rawArguments);
        svgTransform[type](...args);

        const len = points.length;
        for (let i = 0; i < len; i += 2) {
            const {x, y} = svgTransform.map(points[i], points[i + 1]);
            points[i] = x - (x % _config.roundToNearest);
            points[i + 1] = y - (y % _config.roundToNearest);
        }
    });
}

function interpolatePath(path) {
    const data = [];
    let subPathStartX = 0;
    let subPathStartY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let args;
    let match;
    while (match = commandRegEx.exec(path)) {
        const [, code, rawArguments] = match;
        let points = parseArguments(rawArguments);
        let calculator;

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
        return processSVG(svg);
    }
};