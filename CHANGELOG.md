# Changelog

All notable changes are documented here.

## 1.0.0

### Breaking changes

- Invalid SVG path data and transforms now throw clear errors instead of being
  partially ignored.
- Sampling now accepts optional `maxSamples` and `maxOutputPoints` limits. A
  limit that is reached throws a `RangeError` rather than returning partial data.
- The package requires Node.js 22 or newer and is ESM-only.

### Improvements

- Transform handling supports complete transform lists, nested transforms, and
  path-level transforms.
- Browser, Windows, package-consumer, and Node 22/24/26 checks run in CI.
- The affine matrix implementation is independently maintained by this project.
