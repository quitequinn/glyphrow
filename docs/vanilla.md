# Vanilla JS guide

The core has no dependencies and works in any bundler or directly in the browser
via a CDN that serves ES modules.

## Install

```bash
npm install glyphrow
```

```js
import { Glyphrow, autoInit } from "glyphrow";
import "glyphrow/styles.css";
```

## Programmatic API

```js
const tester = new Glyphrow(host, options);
tester.getState();          // snapshot of the current typographic state
tester.setText("Grüße", "de"); // replace the sample (and its lang)
tester.setStyle("bold");    // switch style (with the `styles` option)
tester.destroy();           // remove listeners and observers, and built DOM
```

`host` is any element; the tester renders into it and adds the `glyphrow` class.

## Server-rendered markup

`renderHTML(options)` returns the tester's full initial markup as an HTML
string — the host `div` with the sample at its size and the controls bar — for
any server (Node, edge, a static build). Text and attributes are escaped.

```js
// server
import { renderHTML } from "glyphrow";
const html = renderHTML(options); // <div class="glyphrow" data-glyphrow-rendered …>…</div>
```

```js
// client: adopts the markup instead of rebuilding it
import { Glyphrow } from "glyphrow";
new Glyphrow(document.querySelector("#tester > .glyphrow"), options);
```

A host carrying `data-glyphrow-rendered` (and the type/text elements) is
*adopted*: the core attaches listeners to the existing elements, so there is
no flash or layout jump, and the sample reads without JavaScript. Pass the same
options on both sides; `hydrate: false` forces a rebuild. `destroy()` leaves
adopted markup in place (it only removes listeners and anything it added).

## Extra controls

`extraControls` adds your own controls to the bar, in a
`<div class="glyphrow__extra">` slot (`display: contents`, so each child is a
bar segment; give it `glyphrow__control` for the segment styling). Pass nodes,
or a function that receives the slot and the instance and may return a cleanup:

```js
new Glyphrow(host, {
  text: "Hamburgefonstiv",
  controls: { size: true },
  extraControlsPosition: "start", // default "end"
  extraControls: (slot, tester) => {
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Sample text");
    select.add(new Option("Deutsch", "de"));
    select.addEventListener("change", () => tester.setText("Grüße aus Köln", select.value));
    const label = document.createElement("label");
    label.className = "glyphrow__control";
    label.append(select);
    slot.append(label);
  },
});
```

### Example

```js
const tester = new Glyphrow(document.querySelector("#demo"), {
  text: "Hamburgevons",
  fontFamily: "Inter",
  fallback: "Helvetica, Arial, sans-serif",
  size: 120,
  tracking: 0,
  weight: 400,
  controls: {
    size: { min: 16, max: 320 },
    tracking: true,
    weight: true,
    italic: true,
    align: true,
    wrap: true,
    features: ["liga", "dlig", "smcp", "onum", "ss01"],
  },
  onChange: (state) => {
    document.querySelector("#out").textContent = JSON.stringify(state, null, 2);
  },
});
```

## Declarative `data-*` API

Mark up an element and call `autoInit()`:

```html
<div
  data-glyphrow
  data-font="Inter"
  data-size="96"
  data-text="Typography"
  data-tracking="0"
  data-weight="500"
  data-align="center"
  data-features="smcp,onum"
  data-controls="size,tracking,weight,italic,align,wrap,features"
  data-placeholder="Type something…"
></div>
```

```js
import { autoInit } from "glyphrow";
autoInit();              // whole document
autoInit(someContainer); // or a subtree
```

### Recognised attributes

| Attribute | Maps to |
| --- | --- |
| `data-font` | `fontFamily` |
| `data-fallback` | `fallback` |
| `data-size` | `size` (`"fit"` for auto-fit) |
| `data-tracking` | `tracking` (em) |
| `data-weight` | `weight` |
| `data-italic` | `italic` (`"false"` to disable) |
| `data-align` | `align` |
| `data-wrap` | `wrap` (`"false"` for single line) |
| `data-features` | `features` (comma/space list) |
| `data-editable` | `editable` (`"false"` for read-only) |
| `data-placeholder` | `placeholder` |
| `data-aria-label` | `ariaLabel` |
| `data-lang` | `lang` (language of the sample) |
| `data-dir` | `dir` (`ltr`, `rtl` or `auto`) |
| `data-show-values` | `showValues` (`"true"` to show values inline) |
| `data-palette` | `palette` (colour-font `font-palette`) |
| `data-synthesis` | `synthesis` (`"false"` for honest proofing) |
| `data-controls` | `controls` (comma list of control keys, incl. `axes`, `palette`) |

The `variable` axis config, `styles`, custom feature objects and
`extraControls` have no `data-*` form — set them via the programmatic API.

`autoInit()` is idempotent: it marks elements with `data-glyphrow-ready` and skips
them on subsequent calls, so it is safe to run after dynamic content loads.

## Auto-fit

Set `size: "fit"` (or `data-size="fit"`) to size the text to the container width.
Fitting uses a `ResizeObserver`, recomputes after web fonts load, and is
rAF-debounced while typing — no layout thrashing, and it reflows on resize.
