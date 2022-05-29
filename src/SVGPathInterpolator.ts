import { SaxEventType, SAXParser, Tag } from 'sax-wasm';
import { calculators } from './math/calculators.js';
import { SVGTransform } from './math/SVGTransform.js';

const commandRegEx = /(m|l|c|q|z|a|v|h|s|z)(?: ?)([\d+-., ]*)/ig;
const argumentsRegEx = /([-]?\d+\.*\d*)(?:,| )?/g;
const transformRegEx = /(matrix|translate|scale|rotate|skewX|skewY)(?:\()(.*)(?:\))/;
type CallableSvgTransform = {[P in keyof SVGTransform]: SVGTransform[P] extends CallableFunction ? P: never}[keyof SVGTransform]
export interface SVGInterpolatorConfig {
  joinPathData: false,
  minDistance: number,
  roundToNearest: number,
  sampleFrequency: number,
  parser: SAXParser
}

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
  parser: SAXParser;

  constructor(config: SVGInterpolatorConfig = {
    joinPathData: false,
    minDistance: +0.5,
    roundToNearest: +0.25,
    sampleFrequency: +0.001,
    parser: null
  }) {
    Object.assign(this, config);
  }

  parseArguments(source: string): (string | number)[] {
    const args: (string | number)[] = [];
    let arg;
    while (arg = argumentsRegEx.exec(source)) {
      if (isFinite(+arg[1])) {
        args.push(+arg[1]);
      } else {
        args.push(arg[1]);
      }
    }
    return args;
  }

  processSVG(data: Uint8Array): number[] | Record<string, number[]> {
    const openTagsDepth: Record<string, number> = {};
    const transforms: Record<string, string> = {};
    let interpolatedPaths = this.joinPathData ? []:{};
    let i = Date.now();
    this.parser.eventHandler = (event, node: Tag) => {
      if (event===SaxEventType.OpenTag) {
        if (!openTagsDepth[node.name]) {
          openTagsDepth[node.name] = 0;
        }
        const depth = openTagsDepth[node.name]++;
        const transform = node.attributes.find(attr => attr.name.value==='transform')
        if (transform) {
          transforms[depth + node.name] = transform.value.value;
        }

        if (node.name==='path') {
          const p = node.attributes.find(attr => attr.name.value==='d')
          const points = this.interpolatePath(p.value.value);
          this.applyTransforms(transforms, points);
          if (!this.joinPathData) {
            const id = node.attributes.find(attr => attr.name.value==='id')
            const key = id ? id.value.value:`path_${ i++ }`;
            (interpolatedPaths as Record<string, number[]>)[key] = points;
          } else {
            interpolatedPaths = (interpolatedPaths as number[]).concat(points);
          }
        }
      } else {
        const depth = --openTagsDepth[node.name];
        delete transforms[depth + node.name];
      }
    };

    this.parser.write(data);
    this.parser.end();
    return interpolatedPaths;
  }

  applyTransforms(transforms: Record<string, string>, points: number[]) {
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
      const args = this.parseArguments(rawArguments);
      svgTransform[type as CallableSvgTransform].call(svgTransform, ...args);

      const len = points.length;
      for (let i = 0; i < len; i += 2) {
        const { x, y } = svgTransform.map(points[i], points[i + 1]);
        points[i] = x - (x % this.roundToNearest);
        points[i + 1] = y - (y % this.roundToNearest);
      }
    });
  }

  interpolatePath(path: string): number[] {
    const data = [];
    let subPathStartX = 0;
    let subPathStartY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let args;
    let match;
    let lastCommand = { command: '', points: undefined, offsets: undefined };
    while (match = commandRegEx.exec(path)) {
      const [, command, rawArguments] = match;
      let points = this.parseArguments(rawArguments) as number[];

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
        case 'T':
        case 't':
          let lastCtrlX;
          let lastCtrlY;
          const { command: lastC, points: lastP } = lastCommand;
          const reg = command.toLowerCase()==='s' ? /^[cs]$/:/^[qt]$/;
          if (reg.test(lastC.toLowerCase())) {
            const { length } = lastP;
            lastCtrlY = lastP[length - 3];
            lastCtrlX = lastP[length - 4];
          }
          args = points;

          if (/^[st]$/.test(command)) {
            this.applyOffset(offsetX, offsetY, args, 4);
          }
          args.unshift(offsetX, offsetY, lastCtrlX, lastCtrlY);
          args = [args];
          break;

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
      if (calculator) {
        args.push(this.minDistance, this.roundToNearest, this.sampleFrequency);
        const pts = calculator(...args);
        data.push(...pts);
        const len = ~~points.length;

        offsetY = points[len - 1];
        offsetX = points[len - 2];
      }
      lastCommand = { command, points, offsets };
    }
    if (this.trim) {
      this.trimPathOffsets(data);
    }
    return data;
  }

  trimPathOffsets(paths: number[]) {
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

  applyOffset(offsetX: number, offsetY: number, coords: number[] = [], setLength = 2) {
    for (let i = 0; i < coords.length; i++) {
      if (i && i % +setLength===0) {
        offsetX = coords[i - 2];
        offsetY = coords[i - 1];
      }
      coords[i] += (i % 2 ? +offsetY:+offsetX);
    }
    return coords;
  }
}
