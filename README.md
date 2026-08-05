# fabric.TextFreeLine

A custom [Fabric.js](http://fabricjs.com/) object that renders text along a fully interactive, free-form cubic Bézier path — with inline double-click editing support.

## Features

- **Text on a Bézier curve** — each character is placed as a rigid body, translated to the path point and rotated to follow the tangent (baseline stays on the path).
- **7-point dual-segment path** — two chained cubic Bézier segments give you smooth, expressive curves with intuitive control handles.
- **Interactive control points** — drag anchor and control-handle points on an SVG overlay to reshape the curve in real time.
- **Inline editing** — double-click to enter `fabric.IText`-style text editing; the object falls back to a flat layout while in edit mode and re-flows onto the curve on exit.
- **Configurable kerning** — add or remove spacing between characters independently of font metrics.
- **Flip** — mirror the text upside-down along the path with a single boolean flag.
- **Full serialisation** — `toObject` / `fromObject` round-trip support including all custom properties.
- **No extra dependencies** — only Fabric.js (≥ 5.x) is required.

## Demo

Open [`index.html`](./index.html) in a browser (no build step needed):

```
open index.html
# or serve locally:
python3 -m http.server
```

The demo page lets you change the text, fill color, font size, font family, kerning, and flipped state, and toggle an interactive control-point editor overlay directly on the canvas.

## Usage

Include Fabric.js and then `TextFreeLine.js` in your page:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js"></script>
<script src="./TextFreeLine.js"></script>
```

Then create a `fabric.TextFreeLine` object and add it to a canvas:

```js
const canvas = new fabric.Canvas('c');

const textObj = new fabric.TextFreeLine('Hello, World!', {
  left: 400,
  top: 300,
  originX: 'center',
  originY: 'center',
  fill: '#005580',
  fontSize: 60,
  fontFamily: 'Arial',
  kerning: 0,
  flipped: false,
  editable: true,
  objectCaching: false,
});

canvas.add(textObj);
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `text` | `string` | — | The text to render along the path. |
| `fontSize` | `number` | `40` | Font size in pixels. |
| `fontFamily` | `string` | `'Times New Roman'` | CSS font family. |
| `fontWeight` | `string` | `'normal'` | CSS font weight. |
| `fontStyle` | `string` | `'normal'` | CSS font style. |
| `fill` | `string` | `'rgb(0,0,0)'` | Character fill color. |
| `stroke` | `string` | `null` | Optional stroke color for characters. |
| `strokeWidth` | `number` | `1` | Stroke width when `stroke` is set. |
| `kerning` | `number` | `0` | Extra spacing (px) added between characters. Negative values tighten the text. |
| `flipped` | `boolean` | `false` | When `true`, rotates all characters 180° — useful for text below a path. |
| `ctrlPts` | `Array<{x,y}>` | See below | 7 normalised control points defining the dual-segment Bézier path. |

### `ctrlPts` format

`ctrlPts` is an array of **7 points** in normalised coordinates (`x` and `y` in the range `[0, 1]`, scaled internally to the text's pixel width and font size):

```
[ anchor0, ctrl0, ctrl1, anchor1, ctrl2, ctrl3, anchor2 ]
```

The path is made of two cubic segments:

- Segment 1: `anchor0 → ctrl0, ctrl1 → anchor1`
- Segment 2: `anchor1 → ctrl2, ctrl3 → anchor2`

The default control points produce a gentle wave:

```js
[
  { x: 0,   y: 1   },
  { x: 1/6, y: 1   },
  { x: 2/6, y: 0.8 },
  { x: 0.5, y: 0.8 },
  { x: 4/6, y: 0.8 },
  { x: 5/6, y: 1   },
  { x: 1,   y: 1   },
]
```

### Serialisation

```js
// Serialise
const json = canvas.toJSON();

// Restore
fabric.util.enlivenObjects([json.objects[0]], ([obj]) => {
  canvas.add(obj);
});

// Or use fromObject directly
fabric.TextFreeLine.fromObject(objectData, (obj) => {
  canvas.add(obj);
});
```

## API

### Properties

| Property | Type | Description |
|---|---|---|
| `ctrlPts` | `Array<{x,y}>` | 7 normalised Bézier control points. |
| `kerning` | `number` | Extra inter-character spacing in pixels. |
| `flipped` | `boolean` | When `true`, text flows along the underside of the path. |

### Methods

Inherits all `fabric.IText` methods. The following are overridden internally:

| Method | Description |
|---|---|
| `set(key, value)` | Watches `ctrlPts`, `kerning`, `flipped`, and text/font properties and recomputes the curve layout automatically. |
| `enterEditing()` | Switches to flat (straight-line) layout for inline editing. |
| `exitEditing()` | Re-flows text onto the Bézier path after editing. |
| `toObject(props)` | Includes `ctrlPts`, `kerning`, and `flipped` in the serialised output. |

## How it works

1. **Path construction** — the 7 control points are scaled from normalised space to pixel space (width = total text width, height = font size). Two `_CubicSeg` instances form a `_BezierPath` with a pre-built arc-length lookup table (200 samples) for accurate distance-to-parameter mapping.

2. **Character placement** — each character's centre is looked up on the path by cumulative advance width. The canvas context is translated to that point and rotated by the path tangent angle before drawing.

3. **Bounding box** — all four corners of each character's bounding box are rotated by the tangent angle and unioned to produce a tight axis-aligned bounding box, keeping Fabric.js hit-testing and selection handles accurate.

4. **Edit mode** — while `isEditing` is `true`, the object renders as a standard flat `fabric.IText` so the native cursor and selection UI work normally.

## License

[MIT](./LICENSE) © Kenneth D'silva
