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
For Node cli users, create a config.json somewhere in your project. See the `sample.config.json` for configuration options.
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
For ES6 users, create a new instance of the SVGPathInterpolator
```js
import SVGPathInterpolator from 'SVGPathInterpolator';
const svgString = `
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"
width="792px" height="612px" viewBox="0 0 792 612" enable-background="new 0 0 792 612" xml:space="preserve">
    <g>
        <path id="path3789" d="M287.168,442.411
        c-8.65,0-15.652,7.003-15.652,15.653
        c0,8.65,7.003,15.69,15.652,15.69
        s15.653-7.04,15.653-15.69
        "/>
    </g>
</svg>
`;
const config = {
    joinPathData: false,
    minDistance: 0.5,
    roundToNearest: 0.25,
    sampleFrequency: 0.001
};
const interpolator = new SVGPathInterpolator(config);
const pathData = interpolator.processSvg(svgString);
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
