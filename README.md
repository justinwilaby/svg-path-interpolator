# SVG Path Interpolator
The SVG Path Interpolator produces point data representing interpolated values within an SVG path.  This is handy when you need to calculate complex paths for animation or drawing APIs beforehand.  Complex paths that include Bézier curves are converted to polygons with a configurable segment sampling size producing more points with greater precision or fewer points for speed.  Polygon path data can be used to animate, draw or for hit detection in games. 

## Install
```bash
npm install svg-path-interpolator --save
```
or as a cli
```bash
npm install -g svg-path-interpolator
```

## Usage
### CLI
Create a config.json somewhere in your project. See the `sample.config.json` for configuration options.
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
Then from your terminal, type
```bash
svgpi ./path/to/config.json ./path/to/target.svg ./output/fileName.json
```
### In the browser as a direct script embed (no-build process)
Copy all files in the `lib/` directory to `svg-interpolator/` on your web server then point a script tag to it. 
```html
<script src="../svg-interpolator/index.js"></script>
```
The `SVGPathInterpolator` will be defined as a global and can be used anywhere
```html
<script type="module" defer>
  const { createInterpolator } = SVGPathInterpolator;
  const interpolator = await createInterpolator({
    joinPathData: true,
    minDistance: 0.5,
    roundToNearest: 0.25,
    sampleFrequency: 0.001,
  }, '../svg-interpolator/sax-wasm.wasm');
  
  // ------ Get the SVG as a Uint8Array Via fetch ----------
  const response = await fetch('./path-to-svg.svg');
  if (!response.ok) {
    return;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  // -------------------------------------------------------
  // --------------- OR from a DOM element -----------------
  const svg = document.querySelector('svg.my-svg');
  const bytes = new TextEncoder().encode(svg.outerHTML);
  //--------------------------------------------------------
  const paths = interpolator.processSVG(bytes);
  console.log('Created', paths.length, 'paths');
</script>
```
### In the browser as a dependency (bundler like webpack or rollup)
```ts
import { createInterpolator } from 'svg-path-interpolator';
// ...
const interpolator = await createInterpolator({
    joinPathData: true,
    minDistance: 0.5,
    roundToNearest: 0.25,
    sampleFrequency: 0.001,
  }, '../svg-interpolator/sax-wasm.wasm');
  
  // ------ Get the SVG as a Uint8Array Via fetch ----------
  const response = await fetch('./path-to-svg.svg');
  if (!response.ok) {
    return;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  // -------------------------------------------------------
  // --------------- OR from a DOM element -----------------
  const svg = document.querySelector('svg.my-svg');
  const bytes = new TextEncoder().encode(svg.outerHTML);
  //--------------------------------------------------------
  const paths = interpolator.processSVG(bytes);
```

### joinPathData
When `joinPathData` is `true`, all path data is joined in a single array as the output. When `false`, each path is separated by the path `id` attribute in a json object as the output. If no `id` attribute exists on the path, a unique id is created.

### minDistance
`minDistance` is the minimum distance between the current and previous points when sampling.  If a sample results in a distance less than the specified value, the point is discarded.

### roundToNearest
`roundToNearest` is useful when snapping to fractional pixel values.  For example, if `roundToNearest` is `.25`, a sample resulting in the point 2.343200092,4.6100923 will round to 2.25,4.5

### sampleFrequency
 `sampleFrequency` determines the increment of `t` when sampling. If `sampleFrequency` is set to `.001` , since `t` iterates from 0 to 1, there will be 1000 points sampled per command but only points that are greater than `minDistance` are captured.

### pretty (cli only)
When `true`, `pretty` creates formatted json output

### prettyIndent (cli only)
Then number of spaces to indent when `pretty` is `true`

## Examples
### Animating output
See [this pen](https://codepen.io/justinwilaby/pen/dMQdBo) for an example on animating a simple path.
