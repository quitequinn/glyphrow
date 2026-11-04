# Glyphrow

[![npm](https://img.shields.io/npm/v/glyphrow.svg)](https://www.npmjs.com/package/glyphrow) [![npm downloads](https://img.shields.io/npm/dm/glyphrow.svg)](https://www.npmjs.com/package/glyphrow) [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

An accessible, **dependency-free type tester** for the web — a compact bar of controls over a live, editable specimen. Adjust size, tracking, weight, italic, alignment, line-wrap, variable-font axes, and **composable OpenType features** live. Ships a framework-agnostic vanilla core and an optional React component.

![Glyphrow: the segmented control bar (size, tracking, weight, optical, italic, align, wrap, features) beneath a live type specimen](https://raw.githubusercontent.com/quitequinn/glyphrow/master/assets/bar.png?v=2)

**[glyphrow.com](https://glyphrow.com)** · [npm](https://www.npmjs.com/package/glyphrow) · [GitHub](https://github.com/quitequinn/glyphrow)

TypeScript · Zero dependencies · ~8.5 kB min+gzip · React + Vanilla JS · Server-rendered

> Formerly published as `type-tester-tdf` (and briefly `typebar-tdf`); renamed to
> **Glyphrow** to reflect what it really is — a focused type-proofing toolbar: a
> compact bar of controls over a live sample.

> **v2 is a ground-up rewrite.** The legacy jQuery + jQuery UI + BigText widget
> (v1) is preserved at the [`v1.0.0`](https://github.com/quitequinn/glyphrow/releases/tag/v1.0.0)
> git tag. v2 has **no runtime
> dependencies**, builds accessible native controls, escapes all input (no
> `eval`, no `innerHTML`), composes multiple OpenType features at once, and
> auto-fits with `ResizeObserver`. See [Migrating from v1](#migrating-from-v1).

- [Install](#install)
- [Vanilla JS](#vanilla-js) · full guide in [docs/vanilla.md](./docs/vanilla.md)
- [React](#react) · full guide in [docs/react.md](./docs/react.md)
- [Options](#options)
- [Controls](#controls)
- [Server rendering](#server-rendering)
- [Styles (one family per style)](#styles-one-family-per-style)
- [OpenType features](#opentype-features) · [custom labels & samples](#custom-features-labels-and-samples)
- [Extra controls](#extra-controls)
- [Accessibility](#accessibility)
- [Migrating from v1](#migrating-from-v1)
- [Development](#development)

## Install

```bash
npm install glyphrow
```

Import the stylesheet once (optional — the component works without it):

```js
import "glyphrow/styles.css";
```

## Vanilla JS

### Programmatic

```js
import { Glyphrow } from "glyphrow";
import "glyphrow/styles.css";

const tester = new Glyphrow(document.querySelector("#demo"), {
  text: "Typography",
  fontFamily: "Inter",
  size: 96,
  controls: { size: true, tracking: true, weight: true, italic: true, features: true },
});

// later…
tester.destroy();
```

### Declarative (`data-*` auto-init)

```html
<div
  data-glyphrow
  data-font="Inter"
  data-size="96"
  data-text="Typography"
  data-controls="size,tracking,weight,italic,align,features"
></div>

<script type="module">
  import { autoInit } from "glyphrow";
  import "glyphrow/styles.css";
  autoInit(); // initialises every [data-glyphrow] element
</script>
```

`autoInit()` is idempotent — already-initialised elements are skipped.

## React

```tsx
import { Glyphrow } from "glyphrow/react";
import "glyphrow/styles.css";

export function Demo() {
  return (
    <Glyphrow
      text="Typography"
      fontFamily="Inter"
      size={96}
      controls={{ size: true, weight: true, features: true }}
      onChange={(state) => console.log(state)}
    />
  );
}
```

React is a **peer dependency** (>=17); the core stays dependency-free. The
component renders its full markup, so it is
[server-rendered](#server-rendering) and hydrates without a layout jump.

## Options

`new Glyphrow(host, options)` / `<Glyphrow {...options} />`:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `text` | `string` | `""` | Initial sample text. |
| `fontFamily` | `string` | — | Primary family to test (ignored with `styles`). |
| `styles` | `StyleOption[]` | — | One CSS family per style (see [Styles](#styles-one-family-per-style)). |
| `style` | `number \| string` | first | Initial style: index or `value`. |
| `fallback` | `string` | `"sans-serif"` | Fallback stack appended after the family. |
| `size` | `number \| "fit"` | `80` | Px size, or `"fit"` to auto-fit the container. |
| `tracking` | `number` | `0` | Letter-spacing in em. |
| `weight` | `number` | `400` | Font weight (or variable `wght` axis). |
| `italic` | `boolean` | `false` | Italic state. |
| `align` | `"left" \| "center" \| "right"` | `"left"` | Text alignment. |
| `wrap` | `boolean` | `true` | Multi-line wrap vs single line. |
| `features` | `(string \| FeatureOption)[]` | `[]` | Initially active features; ones not offered stay on. |
| `editable` | `boolean` | `true` | Whether the sample is user-editable. |
| `placeholder` | `string` | `"Type to test…"` | Empty-state placeholder (CSS, not real text). |
| `controls` | `ControlsConfig` | `{}` | Which controls to render (see below). |
| `showValues` | `boolean` | `false` | Show each control's value inline (e.g. `Size: 96px`). |
| `variable` | `Record<tag, AxisConfig>` | — | Variable-font axes (see [below](#variable--colour-fonts)). |
| `palette` | `string` | `"normal"` | Initial colour-font palette (`font-palette`). |
| `synthesis` | `boolean` | `true` | Allow faux bold/italic. `false` for honest proofing. |
| `ariaLabel` | `string` | `"Sample text"` | Accessible name for the editable region. |
| `lang` | `string` | — | Language of the sample (`lang`), for localised forms. |
| `dir` | `"ltr" \| "rtl" \| "auto"` | — | Direction of the sample. |
| `plainPaste` | `boolean` | `true` | Paste as plain text on one line. |
| `extraControls` | nodes or `(slot, tester) => cleanup?` | — | Your own controls in the bar (see [Extra controls](#extra-controls)). |
| `extraControlsPosition` | `"start" \| "end"` | `"end"` | Where the extra controls sit. |
| `idPrefix` | `string` | generated | Prefix for element ids (match server and client). |
| `hydrate` | `boolean` | auto | Adopt server-rendered markup in the host; `false` rebuilds. |
| `onChange` | `(state) => void` | — | Called on every state change. |

The instance has `getState()`, `setText(text, lang?)`, `setStyle(indexOrValue)`
and `destroy()`. State includes `style` (the active style's value), `lang`,
`features` (active built-in tags) and `featureKeys` (every active feature).

When `fontFamily` is set, Glyphrow asks the browser (Font Loading API) to load
the matching weight/style as you change them, so toggling italic or weight uses
the real glyphs instead of a heavier-looking fallback.

## Controls

`controls` selects which interactive controls appear. A `true` value uses the
default range; an object overrides it:

```js
controls: {
  size: { min: 12, max: 240, step: 1 }, // or `true`
  tracking: true,                       // em slider
  weight: true,                         // 100–900, or the variable axis
  italic: true,                         // aria-pressed toggle button
  align: true,                          // native <select>
  wrap: true,                           // single-line toggle
  features: true,                       // full OpenType list, or tags / FeatureOption objects
  featuresReset: true,                  // "Reset" button in the features panel (or a label)
  style: true,                          // style select (with the `styles` option)
  axes: true,                           // a slider per variable axis (or string[] subset)
  palette: ["normal", "light", "dark"], // colour-font palette <select> (or `true`)
}
```

Default ranges: size `8–300px`, tracking `-0.1–0.5em`, weight `100–900` step 100.

## Server rendering

The tester's markup is described once and rendered three ways — built into the
DOM by the vanilla core, serialised by `renderHTML()`, and rendered by the
React component — so all three produce the same elements. Server-rendered
markup shows the sample at its size, family and features, and the controls bar,
**before any JavaScript runs**. On the client the core *adopts* it (attaching
listeners to the existing elements) instead of rebuilding, so there is no
blank area and no layout jump.

**React** (Next.js, Remix, any `renderToString`): nothing to do — `<Glyphrow>`
renders its full markup on the server and hydrates. **Vanilla**:

```js
// server
import { renderHTML } from "glyphrow";
const html = `<div id="tester">${renderHTML(options)}</div>`;

// client
import { Glyphrow } from "glyphrow";
new Glyphrow(document.querySelector("#tester > .glyphrow"), options);
```

Use the same options on both sides. A host with `data-glyphrow-rendered` is
adopted (`hydrate: false` rebuilds); `destroy()` leaves adopted markup in place.
With `size: "fit"` the size is only known in the browser, so it is fitted after
load.

## Styles (one family per style)

When each style of a typeface is served as its **own CSS family** (static or
variable), pass them as `styles`. A style select switches the family; the
weight and italic controls are not rendered (the style replaces them).

```js
new Glyphrow(el, {
  styles: [
    { label: "Regular", family: "acme-regular", value: "regular" },
    { label: "Italic", family: "acme-italic", value: "italic" },
    {
      label: "Variable",
      family: "acme-vf",
      value: "vf",
      axes: { wght: { min: 100, max: 900, default: 400, label: "Weight" }, wdth: { min: 75, max: 125, default: 100 } },
    },
  ],
  style: "regular",
  controls: { style: true, size: true, axes: true },
});
```

| `StyleOption` | Meaning |
| --- | --- |
| `label` | Name in the select. |
| `family` | The CSS family that renders it. |
| `value` | Stable id, reported as `state.style` (default: the index). |
| `weight` | `font-weight` to set; match the family's `@font-face`. Unset renders at normal. |
| `italic` | Set `font-style: italic`; only if the `@font-face` declares italic. |
| `axes` | The style's variable axes, `wght` included; `default` is its own coordinate. |

With `controls.axes`, each axis of any style gets a slider; sliders the shown
style lacks are hidden, and switching style moves untouched sliders to the new
style's coordinates (an axis the visitor moved keeps its value). A single-face
family needs no `weight`/`italic`: leaving them unset avoids faux bold/italic.

## Variable & colour fonts

**Variable axes.** Configure any axis by its 4-character tag in `variable`, then
enable sliders with `controls.axes`. `wght` is special — it drives the weight
control; all other axes (`opsz`, `slnt`, `wdth`, `ital`, or custom `GRAD`/`SOFT`/
`WONK`…) get their own slider and compose into one `font-variation-settings`.

```js
new Glyphrow(el, {
  fontFamily: "Fraunces",
  variable: {
    wght: { min: 100, max: 900 },
    opsz: { min: 9, max: 144, default: 40, label: "Optical" },
    slnt: { min: -10, max: 0 },
  },
  controls: { weight: true, axes: true }, // weight = wght; opsz + slnt = axis sliders
});
```

When an `opsz` axis is configured, `font-optical-sizing: none` is set so your
manual value isn't overridden by the browser's automatic optical sizing.

![Fraunces at weight 200 / optical 12 versus weight 850 / optical 144, showing the variable axes](https://raw.githubusercontent.com/quitequinn/glyphrow/master/assets/axes.png?v=2)

**Colour fonts** (COLR/CPAL — e.g. Nabla, Bungee Spice). They render in colour
automatically; expose palette switching with `controls.palette` (sets
`font-palette`). Use the keywords `normal`/`light`/`dark`, or custom palettes you
define with [`@font-palette-values`](https://developer.mozilla.org/docs/Web/CSS/@font-palette-values):

```css
@font-palette-values --brand {
  font-family: Nabla;
  base-palette: 2;
}
```
```js
controls: { palette: ["normal", "light", "dark", "--brand"] }
```

![The Nabla colour font in two custom palettes — sunset and candy](https://raw.githubusercontent.com/quitequinn/glyphrow/master/assets/colour.png?v=2)

**Honest proofing.** Set `synthesis: false` to apply `font-synthesis: none`, so a
missing bold/italic renders as the real font rather than a faux (synthesised)
style — useful when proofing which weights/styles a family actually ships.

Static, bitmap (sbix/CBDT), SVG, emoji and icon fonts all work too — they need no
special controls beyond size/features.

## OpenType features

Unlike v1 (one feature at a time), **features compose**: selecting Small Caps
and Oldstyle Figures yields `font-feature-settings: "smcp" 1, "onum" 1`.

```js
import { FEATURES, featureSettings } from "glyphrow";

featureSettings(["smcp", "onum"]); // => '"smcp" 1, "onum" 1'
```

![Fraunces with default lining figures versus oldstyle figures and fractions enabled](https://raw.githubusercontent.com/quitequinn/glyphrow/master/assets/features.png?v=2)

### Custom features (labels and samples)

`features` and `controls.features` also take objects, so you can show a
foundry's own names, offer any tag (`cv01`–`cv99`, `titl`, …) or a raw
`font-feature-settings` value, group the panel and show a sample beside each
feature. There is no limit on how many. Plain tag strings keep working.

```js
controls: {
  features: [
    { tag: "ss01", label: "Open digits", group: "Figures", sample: "0123" },
    { tag: "cv03", value: 2, label: "Single-storey a", group: "Alternates", sample: "a" },
    { settings: "'ss02' 1, 'ss03' 1", label: "Geometric set", group: "Sets" },
    "onum", // built-in label: "Oldstyle Figures"
  ],
  featuresReset: "Reset features",
},
features: [{ settings: "'ss05' 1" }], // always on (not offered)
```

| `FeatureOption` | Meaning |
| --- | --- |
| `tag` | Any 4-character tag. |
| `value` | Value written when on (default `1`). |
| `settings` | Raw settings instead of `tag`; only quoted tags with an integer/on/off value are kept, anything else drops the feature. |
| `label` | Shown next to the checkbox (default: built-in label, then the tag). |
| `group` | Panel heading; any group groups the panel (ungrouped → "Other"). |
| `sample` | Shown beside the label in the tested font with the feature on (`aria-hidden`; the label names it). |

The features button shows how many features are on (`.glyphrow__count`,
e.g. "2 on"; default-on ligatures are not counted).

Supported built-in tags include ligatures (`liga`, `dlig`, `hlig`, `clig`), case (`smcp`,
`c2sc`, `case`, `cpsp`), figures (`lnum`, `onum`, `pnum`, `tnum`, `zero`, `ordn`),
fractions (`frac`, `afrc`), alternates (`swsh`, `calt`, `salt`, `hist`, `nalt`),
position (`sups`, `subs`), and stylistic sets `ss01`–`ss20`. Restrict the offered
set with `controls: { features: ["smcp", "onum", "ss01"] }`.

## Extra controls

Add your own controls to the bar — a language-sample select, a note about
characters the style lacks. They go in a `.glyphrow__extra` slot
(`display: contents`, so each child is a bar segment; give it
`glyphrow__control` for the segment styling), after the built-in controls or
first with `extraControlsPosition: "start"`.

```tsx
// React: children
<Glyphrow text={sample.text} lang={sample.lang} controls={{ size: true }}>
  <label className="glyphrow__control">
    <select aria-label="Sample text" onChange={pickSample}>…</select>
  </label>
</Glyphrow>
```

```js
// Vanilla: nodes, or a function receiving the slot and the instance
new Glyphrow(el, {
  extraControls: (slot, tester) => {
    slot.append(select);
    select.addEventListener("change", () => tester.setText(texts[select.value], select.value));
    return () => {/* cleanup on destroy */};
  },
});
```

In React, `text`/`lang` prop changes are applied in place (no rebuild), and
children re-render with your component without touching the tester.

## Accessibility

- Native `<input type="range">`, `<button aria-pressed>`, `<select>`, and
  checkbox feature toggles — full keyboard support out of the box.
- Editable region is a labelled `role="textbox"` with `aria-multiline`; the
  placeholder is CSS-only, so screen readers never read stale text.
- The features panel is a disclosure: it manages focus, closes on `Escape` /
  outside click / focus leaving, and exposes `aria-expanded` / `aria-controls`.
- No per-tick announcements: each native control reports its own value to
  assistive tech (a live region here would flood it). Feature samples are
  `aria-hidden`; the label names the feature.
- Pasted text is inserted as plain text, so it never brings foreign styling.
- Toggle states use weight + colour (not colour alone); animations respect
  `prefers-reduced-motion`.

## Styling & themes

The controls render as a **slim, borderless segmented bar** under the sample. It
stays hidden until the tester is engaged — clicking the sample (or tabbing into
any control) reveals it via `:focus-within`, and it collapses again when focus
leaves. Each segment shows only its **title** by default; the control titles
`mix-blend-mode: difference` against the bar so they stay legible over the slider
fills. Set [`showValues`](#options) to also show the value (`Size: 96px`). Import
the stylesheet to get it:

```js
import "glyphrow/styles.css";
```

The look is **monochrome by default** and driven by CSS variables on the host:

| Variable | Default | Purpose |
| --- | --- | --- |
| `--glyphrow-accent` | `#000` | Focus rings, slider/checkbox accent |
| `--glyphrow-bg` / `--glyphrow-fg` | `#fff` / `#000` | Component background / text |
| `--glyphrow-bar-bg` | `#fff` | Bar background |
| `--glyphrow-bar-track` | `#e5e5e5` | Unfilled slider track |
| `--glyphrow-bar-fill` | `#000` | Filled slider track / pressed toggle |
| `--glyphrow-bar-h` | `26px` | Bar (segment) height |
| `--glyphrow-bar-radius` | `6px` | Bar corner radius |
| `--glyphrow-speed` | `0.18s` | Reveal transition |

| `--glyphrow-panel-bg` / `--glyphrow-panel-fg` | bg / fg | Features panel colours |
| `--glyphrow-panel-border` / `--glyphrow-panel-shadow` | — | Features panel border and shadow |
| `--glyphrow-fill` | (set per slider) | Filled share of a slider's track, `0%`–`100%` |

Override any of them, e.g. `.glyphrow { --glyphrow-accent: #e11d48; }`.

**Class names are a stable API** for theming (icons, drawn sliders, chips):

| Class | Element |
| --- | --- |
| `.glyphrow` (+ `--show-values`, `--dark`) | Host |
| `.glyphrow__stage` › `.glyphrow__type` › `.glyphrow__text` | Sample (type styles on `__type`) |
| `.glyphrow__controls` | The bar (`role="group"`) |
| `.glyphrow__control`, `.glyphrow__control--{key}` | A segment; key = `size`, `tracking`, `weight`, `axis-{tag}`, `align`, `palette`, `style`, `features` |
| `.glyphrow__caption` › `.glyphrow__label`, `.glyphrow__value` | Title and value overlaid on a segment |
| `.glyphrow__slider`, `.glyphrow__slider--{key}` (`[data-axis]` on axes) | Range inputs |
| `.glyphrow__toggle`, `.glyphrow__toggle--{italic,wrap,features}` | Buttons |
| `.glyphrow__select`, `.glyphrow__select--{align,palette,style}` | Selects |
| `.glyphrow__count` | Features-on count in the features button |
| `.glyphrow__panel` › `.glyphrow__feature-group` › `.glyphrow__feature-legend` | Features panel and groups |
| `.glyphrow__feature` › `input`, `.glyphrow__feature-label`, `.glyphrow__feature-sample` | One feature |
| `.glyphrow__reset` | Reset button |
| `.glyphrow__extra` | Slot for your controls |

To keep the bar always visible instead of revealing it on focus, or to give
visitors a hide/show button, style `.glyphrow__controls` directly, e.g.
`.my-tester .glyphrow__controls { max-height: none; opacity: 1; overflow: visible; pointer-events: auto; transform: none; }`,
and toggle a class that sets `display: none` on it.

A **dark green-on-black** preset ships built in — add `glyphrow--dark` to the host:

```js
new Glyphrow(el, { /* … */ });
el.classList.add("glyphrow--dark");
// React: <Glyphrow className="glyphrow--dark" … />
```

## Migrating from v1

| v1 (jQuery attributes) | v2 |
| --- | --- |
| `class="typeTester"` | `data-glyphrow` (or `new Glyphrow(el, …)`) |
| `font="Inter"` | `data-font="Inter"` / `fontFamily: "Inter"` |
| `size="90"` / `size=""` (fit) | `data-size="90"` / `data-size="fit"` |
| `weightoptions="true"` | `data-controls="weight"` / `controls: { weight: true }` |
| `optoptions="dlig,hlig"` | `data-features` / `controls: { features: [...] }` |
| magic words `"yup"`, `"nope"` | plain booleans / `"true"` / `"false"` |
| jQuery + jQuery UI + BigText | **no dependencies** |

The v1 source remains available at the [`v1.0.0`](https://github.com/quitequinn/glyphrow/releases/tag/v1.0.0) git tag.

## Development

```bash
npm install
npm run build      # bundle ESM + CJS + types (tsup)
npm test           # vitest + jsdom
npm run typecheck  # tsc --noEmit
npm run dev        # watch build
npm run capture    # regenerate the README images (Playwright → assets/)
```

The README's feature images are generated by a reproducible capture harness —
see [docs/screenshots.md](./docs/screenshots.md) for the approach and a reusable
recipe.

## License

ISC © Quinn Keaveney. Originally built for [The Designers Foundry](https://www.thedesignersfoundry.com/).
