# SVG Path Interpolator

SVG Path Interpolator samples SVG paths into flat arrays of x/y coordinates for drawing, animation, and hit detection. Sampling distance and precision are configurable.

## Requirements

Node.js 22 or newer is required for the CLI and Node API. Browser use requires modern ES modules and WebAssembly support.

## Install

```bash
npm install svg-path-interpolator
```

For the CLI, install globally with `npm install -g svg-path-interpolator` or run it through `npx`.

## CLI

Create a config file:

```json
{
  "joinPathData": false,
  "minDistance": 0.5,
  "roundToNearest": 0.25,
  "sampleFrequency": 0.001,
  "pretty": false,
  "prettyIndent": 0
}
```

Then run:

```bash
svgpi ./config.json ./drawing.svg ./points.json
```

Omit the output path to print the JSON to stdout. See [sample.config.json](config/sample.config.json) for the same settings.

## Node API

`sax-wasm` includes the WebAssembly binary. Load it from that package and pass the bytes to `createInterpolator`:

```js
import { readFile } from 'node:fs/promises';
import { createInterpolator } from 'svg-path-interpolator';

const wasmUrl = new URL(import.meta.resolve('sax-wasm/lib/sax-wasm.wasm'));
const wasm = await readFile(wasmUrl);
const interpolator = await createInterpolator({ joinPathData: true }, wasm);

const svg = await readFile('./drawing.svg');
const points = interpolator.processSVG(svg);
```

`createInterpolator` also accepts a browser-accessible URL or a `Response` as its second argument. It requires that argument because the package does not copy the WASM binary into its own `lib` directory.

## Browser API

With a bundler, copy `node_modules/sax-wasm/lib/sax-wasm.wasm` to a public URL, then pass that URL to `createInterpolator`:

```js
import { createInterpolator } from 'svg-path-interpolator';

const interpolator = await createInterpolator({ joinPathData: true }, '/assets/sax-wasm.wasm');
const response = await fetch('/drawing.svg');
const points = interpolator.processSVG(new Uint8Array(await response.arrayBuffer()));
```

For a browser without a bundler, serve this package's `lib/` directory and the `sax-wasm` package's `lib/` directory. An import map resolves the bare `sax-wasm` import:

```html
<script type="importmap">
  {"imports": {"sax-wasm": "/vendor/sax-wasm/lib/esm/index.js"}}
</script>
<script type="module">
  import { createInterpolator } from '/vendor/svg-path-interpolator/lib/index.js';

  const interpolator = await createInterpolator(
    { joinPathData: true },
    '/vendor/sax-wasm/lib/sax-wasm.wasm'
  );
  const svg = document.querySelector('svg.my-svg');
  const points = interpolator.processSVG(new TextEncoder().encode(svg.outerHTML));
</script>
```

## Options

- `joinPathData`: When true, return one flat array. Otherwise, return an object keyed by each path's `id` or a generated key.
- `minDistance`: Discard samples closer than this distance to the previous accepted point. Default: `0.5`.
- `roundToNearest`: Snap coordinates to this increment. Default: `0.25`.
- `sampleFrequency`: Increment of the curve parameter `t` between samples. Default: `0.001`.
- `trim`: Translate sampled coordinates so their minimum x and y values are zero. Default: `false`.
- `maxSamples`: Optional maximum number of sampling attempts for a single `interpolatePath` or `processSVG` call. It is shared across every path and every internally decomposed arc in that operation. This limits attempted samples, including samples later discarded by `minDistance`.
- `maxOutputPoints`: Optional maximum number of emitted x/y coordinate pairs for a single interpolation operation. It is shared across every path and decomposed arc after distance filtering and rounding.
- `pretty` and `prettyIndent`: CLI JSON formatting options.

Both budgets must be positive finite integers when supplied. Exceeding either budget throws a `RangeError` before the next sample or point is added; no partial result is returned. The same validation runs when interpolation begins, so mutating an option after construction cannot bypass a limit.

## Development

Install dependencies with `npm ci`. All package source, including the CLI, lives in `src/` as TypeScript. Run `npm run build` to emit ESM and TypeScript declarations into the generated, Git-ignored `lib/` directory. `npm pack` and `npm publish` build it automatically through `prepack`.

- `npm test` builds and runs the Node test suite.
- `npm run test:coverage` runs the suite with Node's coverage report.
- `npm run lint` checks maintained TypeScript, tests, examples, configuration, scripts, documentation, and CI files with Biome.
- `npm run format:check` verifies the tooling, documentation, configuration, example, and CI formatting; use `npm run format` to apply it. Existing `src/` and `test/` formatting is intentionally preserved until its own dedicated migration.
- `npm run verify:package` tests the packed tarball from a fresh consumer project, including its CLI and declarations.
- `npm run test:browser` launches Chromium against the actual browser example. Install its local binary first with `npx playwright install chromium`.
- `npm run check` runs linting, formatting, type checking, coverage, and packed-package verification.

GitHub Actions retains runtime coverage on Node 22, 24, and 26, runs quality and package verification once on Ubuntu, and adds Windows plus real-browser smoke coverage.

The package is ESM-only. Prefer imports from the package root; the existing subpath export remains available for compatibility. The SAX parser's WebAssembly binary remains supplied by `sax-wasm` and must be passed to `createInterpolator`, as shown above.

## Examples

See [examples/index.html](examples/index.html) for a browser example and [this animation](https://codepen.io/justinwilaby/pen/dMQdBo) for a use of the point data.
