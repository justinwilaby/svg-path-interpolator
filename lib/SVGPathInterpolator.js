import { SaxEventType } from 'sax-wasm';
import { calculators } from './math/calculators.js';
import { SVGTransform } from './math/SVGTransform.js';
const commandRegEx = /([mlcqzavhst])\s*([-+\d.eE,\s]*)/ig;
const argumentsRegEx = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const transformRegEx = /(matrix|translate|scale|rotate|skewX|skewY)(?:\()(.*)(?:\))/;
export class SVGPathInterpolator {
    /**
     * When trim is true, paths that were translated
     * are normalized and will begin at 0,0.
     *
     * @var {boolean} trim
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    trim = false;
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
    minDistance = 0.5;
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
    roundToNearest = 0.25;
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
    sampleFrequency = 0.001;
    /**
     * When true, pretty creates formatted json output.
     *
     * @var {boolean} pretty
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    pretty = false;
    /**
     * Then number of spaces to indent when pretty is true.
     *
     * @var {int} prettyIndent
     * @memberOf SVGPathInterpolator#
     * @default 0
     */
    prettyIndent = 0;
    /**
     * Whether to join path data into a single flat array.
     *
     * @var {boolean} joinPathData
     * @memberOf SVGPathInterpolator#
     * @default false
     */
    joinPathData = false;
    /**
     * The SaxWasm parser instance;
     * @var { SAXParser } parser
     * @memberOf SVGPathInterpolator#
     * @default null
     */
    parser;
    constructor(config = {}) {
        Object.assign(this, config);
    }
    parseArguments(source) {
        const args = [];
        let arg;
        while (arg = argumentsRegEx.exec(source)) {
            args.push(+arg[0]);
        }
        return args;
    }
    processSVG(data) {
        if (!this.parser) {
            throw new Error('A prepared SAX parser is required to process SVG');
        }
        const openTagsDepth = {};
        const transforms = {};
        let interpolatedPaths = this.joinPathData ? [] : {};
        let i = Date.now();
        this.parser.eventHandler = (event, detail) => {
            const node = detail;
            if (event === SaxEventType.OpenTag) {
                if (!openTagsDepth[node.name]) {
                    openTagsDepth[node.name] = 0;
                }
                const depth = openTagsDepth[node.name]++;
                const transform = node.attributes.find(attr => attr.name.value === 'transform');
                if (transform) {
                    transforms[depth + node.name] = transform.value.value;
                }
                if (node.name === 'path') {
                    const p = node.attributes.find(attr => attr.name.value === 'd');
                    if (!p) {
                        return;
                    }
                    const points = this.interpolatePath(p.value.value);
                    this.applyTransforms(transforms, points);
                    if (!this.joinPathData) {
                        const id = node.attributes.find(attr => attr.name.value === 'id');
                        const key = id ? id.value.value : `path_${i++}`;
                        interpolatedPaths[key] = points;
                    }
                    else {
                        interpolatedPaths = interpolatedPaths.concat(points);
                    }
                }
            }
            else {
                const depth = --openTagsDepth[node.name];
                delete transforms[depth + node.name];
            }
        };
        this.parser.write(data);
        this.parser.end();
        return interpolatedPaths;
    }
    applyTransforms(transforms, points) {
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
            const transformMatch = transformRegEx.exec(rawTransform);
            if (!transformMatch) {
                return;
            }
            const [, type, rawArguments] = transformMatch;
            const args = this.parseArguments(rawArguments);
            const method = svgTransform[type];
            method.call(svgTransform, ...args);
            const len = points.length;
            for (let i = 0; i < len; i += 2) {
                const { x, y } = svgTransform.map(points[i], points[i + 1]);
                points[i] = x - (x % this.roundToNearest);
                points[i + 1] = y - (y % this.roundToNearest);
            }
        });
    }
    interpolatePath(path) {
        const data = [];
        let subPathStartX = 0;
        let subPathStartY = 0;
        let offsetX = 0;
        let offsetY = 0;
        let match;
        let lastCommand = { command: '' };
        let lastQuadraticControlX = 0;
        let lastQuadraticControlY = 0;
        while (match = commandRegEx.exec(path)) {
            const [, command, rawArguments] = match;
            let points = this.parseArguments(rawArguments);
            let args;
            switch (command) {
                case 'A':
                case 'C':
                case 'L':
                case 'Q':
                    points.unshift(offsetX, offsetY);
                    args = [points];
                    break;
                case 'S':
                case 's':
                    let lastCtrlX = offsetX;
                    let lastCtrlY = offsetY;
                    const { command: lastC, points: lastP } = lastCommand;
                    const reg = command.toLowerCase() === 's' ? /^[cs]$/ : /^[qt]$/;
                    if (reg.test(lastC.toLowerCase()) && lastP) {
                        const { length } = lastP;
                        lastCtrlY = lastP[length - 3];
                        lastCtrlX = lastP[length - 4];
                    }
                    if (/^[st]$/.test(command)) {
                        this.applyOffset(offsetX, offsetY, points, 4);
                    }
                    points.unshift(offsetX, offsetY, lastCtrlX, lastCtrlY);
                    args = [points];
                    break;
                case 'T':
                case 't':
                    for (let i = 0; i < points.length; i += 2) {
                        const reflect = /^[qt]$/i.test(lastCommand.command);
                        const controlX = reflect ? 2 * offsetX - lastQuadraticControlX : offsetX;
                        const controlY = reflect ? 2 * offsetY - lastQuadraticControlY : offsetY;
                        const endX = command === 't' ? offsetX + points[i] : points[i];
                        const endY = command === 't' ? offsetY + points[i + 1] : points[i + 1];
                        data.push(...calculators.q([offsetX, offsetY, controlX, controlY, endX, endY], this.minDistance, this.roundToNearest, this.sampleFrequency));
                        offsetX = endX;
                        offsetY = endY;
                        lastQuadraticControlX = controlX;
                        lastQuadraticControlY = controlY;
                        lastCommand.command = command;
                    }
                    continue;
                case 'a':
                    points.unshift(0, 0);
                    args = [this.applyOffset(offsetX, offsetY, points, 7)];
                    break;
                case 'c':
                    this.applyOffset(offsetX, offsetY, points, 6);
                    points.unshift(offsetX, offsetY);
                    args = [points];
                    break;
                case 'l':
                    points.unshift(0, 0);
                    args = [this.applyOffset(offsetX, offsetY, points, 2)];
                    break;
                case 'q':
                    points.unshift(0, 0);
                    args = [this.applyOffset(offsetX, offsetY, points, 4)];
                    break;
                case 'H':
                    points.unshift(offsetX, offsetY);
                    points.push(offsetY);
                    args = [points];
                    break;
                case 'h':
                    this.applyOffset(offsetX, offsetX, points, 2); // offsetX, offsetX is intentional
                    points.unshift(offsetX, offsetY);
                    points.push(offsetY);
                    args = [points];
                    break;
                case 'm':
                    subPathStartX = points[0] + offsetX;
                    subPathStartY = points[1] + offsetY;
                    args = [this.applyOffset(offsetX, offsetY, points.slice(2), 2)];
                    break;
                case 'M':
                    subPathStartX = points[0];
                    subPathStartY = points[1];
                    args = [points.slice(2)];
                    break;
                case 'V':
                    points.unshift(offsetX, offsetY, offsetX);
                    args = [points];
                    break;
                case 'v':
                    this.applyOffset(offsetY, offsetY, points, 2); // offsetY, offsetY is intentional
                    points.unshift(offsetX, offsetY, offsetX);
                    args = [points];
                    break;
                case 'z':
                case 'Z':
                    points = [offsetX, offsetY, subPathStartX, subPathStartY];
                    args = [points];
                    break;
            }
            const calculator = calculators[command.toLowerCase()];
            const offsets = { offsetX, offsetY };
            if (calculator && args) {
                const pts = calculator(args[0], this.minDistance, this.roundToNearest, this.sampleFrequency);
                data.push(...pts);
                const len = ~~points.length;
                offsetY = points[len - 1];
                offsetX = points[len - 2];
                if (command.toLowerCase() === 'q') {
                    lastQuadraticControlX = points[len - 4];
                    lastQuadraticControlY = points[len - 3];
                }
            }
            lastCommand = { command, points, offsets };
        }
        if (this.trim) {
            this.trimPathOffsets(data);
        }
        return data;
    }
    trimPathOffsets(paths) {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        if (!paths.length) {
            return;
        }
        for (let i = 0; i < paths.length; i += 2) {
            if (paths[i] < minX) {
                minX = paths[i];
            }
            if (paths[i + 1] < minY) {
                minY = paths[i + 1];
            }
        }
        for (let i = 0; i < paths.length; i += 2) {
            paths[i] -= minX;
            paths[i + 1] -= minY;
        }
    }
    applyOffset(offsetX, offsetY, coords = [], setLength = 2) {
        for (let i = 0; i < coords.length; i++) {
            if (i && i % +setLength === 0) {
                offsetX = coords[i - 2];
                offsetY = coords[i - 1];
            }
            coords[i] += (i % 2 ? +offsetY : +offsetX);
        }
        return coords;
    }
}
