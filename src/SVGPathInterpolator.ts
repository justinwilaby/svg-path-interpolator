import { SaxEventType, SAXParser } from 'sax-wasm';
import type { Tag } from 'sax-wasm';
import { calculators } from './math/calculators.js';
import { SVGTransform } from './math/SVGTransform.js';

const commandRegEx = /([mlcqzavhst])\s*([-+\d.eE,\s]*)/ig;
const argumentsRegEx = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const transformRegEx = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
const minimumSampleFrequency = 0.000001;
type TransformMethod = 'matrix' | 'translate' | 'scale' | 'rotate' | 'skewX' | 'skewY';
export interface SVGInterpolatorConfig {
  joinPathData?: boolean,
  minDistance?: number,
  roundToNearest?: number,
  sampleFrequency?: number,
  trim?: boolean,
  parser?: SAXParser
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
   * Values must be between 0.000001 and 1, inclusive, to bound
   * the amount of sampling work performed for each command.
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
  parser?: SAXParser;

  constructor(config: SVGInterpolatorConfig = {}) {
    Object.assign(this, config);
    this.validateNumericOptions();
  }

  private validateNumericOptions() {
    this.validateNumericOption('minDistance', this.minDistance, value => value >= 0, 'greater than or equal to 0');
    this.validateNumericOption('roundToNearest', this.roundToNearest, value => value > 0, 'greater than 0');
    this.validateNumericOption(
      'sampleFrequency',
      this.sampleFrequency,
      value => value >= minimumSampleFrequency && value <= 1,
      `between ${minimumSampleFrequency} and 1, inclusive`
    );
  }

  private validateNumericOption(
    name: 'minDistance' | 'roundToNearest' | 'sampleFrequency',
    value: number,
    isValid: (value: number) => boolean,
    requirement: string
  ) {
    if (!Number.isFinite(value) || !isValid(value)) {
      throw new RangeError(`${name} must be a finite number ${requirement}`);
    }
  }

  parseArguments(source: string): number[] {
    const args: number[] = [];
    let arg;
    while (arg = argumentsRegEx.exec(source)) {
      args.push(+arg[0]);
    }
    return args;
  }

  processSVG(data: Uint8Array): number[] | Record<string, number[]> {
    if (!this.parser) {
      throw new Error('A prepared SAX parser is required to process SVG');
    }
    const transformStack: SVGTransform[] = [];
    let interpolatedPaths = this.joinPathData ? []:{};
    let i = Date.now();
    this.parser.eventHandler = (event, detail) => {
      const node = detail as Tag;
      if (event===SaxEventType.OpenTag) {
        const inheritedTransform = transformStack[transformStack.length - 1];
        const cumulativeTransform = inheritedTransform
          ? new SVGTransform().multiply(inheritedTransform)
          : new SVGTransform();
        const transform = node.attributes.find(attr => attr.name.value==='transform');
        if (transform) {
          cumulativeTransform.multiply(this.parseTransform(transform.value.value));
        }
        transformStack.push(cumulativeTransform);

        if (node.name==='path') {
          const p = node.attributes.find(attr => attr.name.value==='d')
          if (!p) {
            return;
          }
          const points = this.interpolatePath(p.value.value);
          this.applyTransforms(cumulativeTransform, points);
          if (!this.joinPathData) {
            const id = node.attributes.find(attr => attr.name.value==='id')
            const key = id ? id.value.value:`path_${ i++ }`;
            (interpolatedPaths as Record<string, number[]>)[key] = points;
          } else {
            interpolatedPaths = (interpolatedPaths as number[]).concat(points);
          }
        }
      } else {
        transformStack.pop();
      }
    };

    this.parser.write(data);
    this.parser.end();
    return interpolatedPaths;
  }

  private parseTransform(rawTransform: string) {
    const svgTransform = new SVGTransform();
    for (const transformMatch of rawTransform.matchAll(transformRegEx)) {
      const [, type, rawArguments] = transformMatch;
      const args = this.parseArguments(rawArguments);
      if (type === 'matrix') {
        svgTransform.multiply(new SVGTransform(args[0], args[1], args[2], args[3], args[4], args[5]));
        continue;
      }
      if (type === 'translate' && args.length === 1) {
        args.push(0);
      }
      const method = svgTransform[type as TransformMethod] as (...values: number[]) => unknown;
      method.call(svgTransform, ...args);
    }
    return svgTransform;
  }

  applyTransforms(transforms: Record<string, string>, points: number[]): void;
  applyTransforms(transform: SVGTransform, points: number[]): void;
  applyTransforms(transformOrTransforms: SVGTransform | Record<string, string>, points: number[]) {
    const transform = transformOrTransforms instanceof SVGTransform
      ? transformOrTransforms
      : Object.values(transformOrTransforms).reduce(
        (combined, rawTransform) => combined.multiply(this.parseTransform(rawTransform)),
        new SVGTransform()
      );
    if (transform.isIdentity()) {
      return;
    }
    const len = points.length;
    for (let i = 0; i < len; i += 2) {
      const { x, y } = transform.map(points[i], points[i + 1]);
      points[i] = x - (x % this.roundToNearest);
      points[i + 1] = y - (y % this.roundToNearest);
    }
  }

  interpolatePath(path: string): number[] {
    this.validateNumericOptions();
    const data = [];
    let subPathStartX = 0;
    let subPathStartY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let match;
    let lastCommand: { command: string; points?: number[]; offsets?: { offsetX: number; offsetY: number } } = { command: '' };
    let lastQuadraticControlX = 0;
    let lastQuadraticControlY = 0;
    while (match = commandRegEx.exec(path)) {
      const [, command, rawArguments] = match;
      let points = this.parseArguments(rawArguments);
      let args: [number[]] | undefined;

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
          const reg = command.toLowerCase()==='s' ? /^[cs]$/:/^[qt]$/;
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
            data.push(...calculators.q(
              [offsetX, offsetY, controlX, controlY, endX, endY],
              this.minDistance, this.roundToNearest, this.sampleFrequency
            ));
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
      const calculator = calculators[command.toLowerCase() as keyof typeof calculators];
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

  trimPathOffsets(paths: number[]) {
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
