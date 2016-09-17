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
Create a config.json somewhere in your project. See the `sample.config.json` for configuration options
```json
{
  "trim": true,
  "minDistance": 0.5,
  "roundToNearest": 0.25,
  "sampleFrequency": 0.001,
  "pretty": false,
  "prettyIndent": 0
}
```
From your terminal, type
```bash
svgpi ./path/to/config.json ./path/to/target.svg ./output/fileName.json
```
### trim
When `trim` is `true`, paths that were translated are normalized and will begin at 0,0
### minDistance
`minDistance` is the minimum distance between the current and previous points when sampling.  If a sample results in a distance less than the specified value, the point is discarded.
### roundToNearest
`roundToNearest` is useful when snapping to fractional pixel values.  For example, if `roundToNearest` is `.25`, a sample resulting in the point 2.343200092,4.6100923 will round to 2.25,4.5
### sampleFrequency
 `sampleFrequency` determines the increment of `t` when sampling. If `sampleFrequency` is set to `.001` , since `t` iterates from 0 to 1, there will be 1000 points sampled per command but only points that are greater than `minDistance` are captured.
### pretty
When `true`, `pretty` creates formatted json output
### prettyIndent
Then number of spaces to indent when `pretty` is `true`

## Examples
### Animating output
See [this pen](https://codepen.io/justinwilaby/pen/dMQdBo) for an example on animating a simple path.
