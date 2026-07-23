# Generating targeted README screenshots

How Glyphrow's README images are made, why each decision was made, and a
reusable recipe for doing the same in any UI-component repo. The goal is to turn
this into a repeatable prompt/skill — the sections below are written to be lifted
out and generalised.

- **Canonical example in this repo:** [`scripts/capture.html`](../scripts/capture.html),
  [`scripts/capture.mjs`](../scripts/capture.mjs), output in [`assets/`](../assets).
- **Run:** `npm run build && npm run capture` → writes `assets/*.png`.

---

## Philosophy

1. **Targeted, per-feature images — not one big screenshot.** Each image
   illustrates exactly one capability and lives inline in the README section that
   describes it (hero, variable axes, OpenType features, colour fonts…). This is
   the pattern from `cornu-spline` that prompted this.
2. **Reproducible, not hand-captured.** A committed harness renders the component
   in known states and screenshots them. Anyone can regenerate after a UI change;
   no manual cropping, no drift, no "which build was that from?".
3. **Comparisons sell features.** Before/after rows (default vs feature on; light
   vs heavy axis) communicate far more than a single state.

## Why a code harness (vs manual screenshots or a browser-automation MCP)

- **Determinism** — exact text, size, colours, font every time.
- **Regenerates on demand** — change the UI, re-run, README stays current.
- **No flaky tooling** — headless Chromium via Playwright is self-contained;
  it does not depend on a desktop browser or an extension bridge.
- **Per-feature crops** — screenshot a specific element, not a full page.

---

## Architecture

Two files plus an output dir:

```
scripts/capture.html   # declarative "scenes": each = a labelled component state
scripts/capture.mjs    # static server + Playwright → assets/<scene>.png
assets/                # committed PNGs, referenced by the README
```

- **`capture.html`** imports the built bundle (`/dist/…`), then builds a list of
  **scenes** from a config array. Each scene is one DOM element (`.scene` with a
  unique `id`) containing one or more component instances (and optional captions).
  The filename is the scene `id`.
- **`capture.mjs`** starts a tiny Node static server (serving the repo so ES
  modules and the stylesheet resolve), launches headless Chromium, waits for
  fonts, then calls `element.screenshot()` on each `.scene` → `assets/<id>.png`.

Driving a hidden capture page (not the live demo UI) is deliberate: it's far more
stable than scripting clicks/sliders, and lets you compose multiple states and
side-by-side comparisons in one shot.

---

## The 10 techniques & gotchas (the distilled value)

1. **One element per scene; screenshot the element, not the page.**
   `await page.$('#scene').screenshot()` gives a tight crop with no chrome.

2. **`deviceScaleFactor: 2`** on the page → crisp 2× (retina) PNGs.

3. **Wait for fonts before shooting.** `await page.evaluate(() => document.fonts.ready)`
   plus a short settle (`waitForTimeout(~600)`). Without this you capture the
   fallback font or wrong metrics. Expose a readiness promise from the page if you
   load fonts dynamically.

4. **Force-reveal interactive/hidden UI with a capture-only CSS override.**
   Glyphrow's control bar is hidden until `:focus-within`; a `.show-bar` class
   in the capture page forces `max-height:none; opacity:1; pointer-events:auto`
   so the bar shows in a static screenshot. Don't fake the markup — override the
   reveal state.

5. **Transparent corners (the dark-page artifact fix).** Rounded cards on a solid
   fill leave the corner triangles *outside* the radius painted with the page
   background — white nubs on dark READMEs. Fix: set the capture page
   `body { background: transparent }` **and** screenshot with
   `{ omitBackground: true }`. The card keeps its fill + radius; the corners
   become transparent (RGBA), blending on any page.

6. **Serve over HTTP, never `file://`.** ES-module imports, web fonts, and CORS
   need a real origin. A ~20-line Node `http` static server (correct MIME for
   `.js`/`.css`) is enough; bind to port 0 and read the assigned port.

7. **Reference images by absolute `raw.githubusercontent.com` URLs.** Relative
   paths are unreliable across GitHub ↔ npm rendering; absolute raw URLs render in
   both. Form: `https://raw.githubusercontent.com/<owner>/<repo>/<branch>/assets/<name>.png`.

8. **Cache-bust when you regenerate.** GitHub/npm proxy and cache images by URL
   (Camo). Same URL + new bytes can serve the stale image. Append `?v=N` (bump N)
   to force a fresh fetch.

9. **Keep `assets/` out of the npm tarball.** The package `files` allowlist ships
   only `dist/`; the README's absolute URLs pull images from GitHub, so the npm
   page shows them without bloating the package. (Republish only to refresh the
   npm-rendered README text; the images update from GitHub independently.)

10. **Composition that reads well.** Dark scene background; small uppercase
    monospace captions at low opacity; comparison rows stacked with clear labels
    ("default" vs "onum + frac"); generous padding; fixed scene width for a
    consistent gallery feel.

### Font-specific gotchas worth keeping

- **Variable fonts via Google Fonts:** request the axes in the URL
  (`family=Fraunces:opsz,wght@...`). `family=Name` alone may serve a *static*
  default instance, so axis changes do nothing.
- **Colour fonts (COLR/CPAL):** the `font-palette: light/dark` keywords only
  differ if the font flags palettes for those. For a reliable visible change,
  define custom palettes with `@font-palette-values { override-colors: … }`.

---

## Scene config schema (this repo)

```js
const SCENES = [
  {
    id: "bar",                 // → assets/bar.png
    bg: "#0b0b0c",             // card background
    vars: { "--glyphrow-fg": "#ededed", "--glyphrow-bar-fill": "#ededed" }, // host CSS vars
    showBar: true,             // apply the force-reveal override
    rows: [                    // 1 row = 1 component instance (+ optional label)
      { label: "wght 850 · opsz 144", cfg: { /* component options */ } },
    ],
  },
];
```

`cfg` is whatever your component constructor takes. For a comparison image, give
the scene two rows with the same text and different options.

---

## Apply-to-any-project checklist

1. `npm i -D playwright && npx playwright install chromium`.
2. Add `scripts/capture.html` (import your built bundle, define `SCENES`).
3. Add `scripts/capture.mjs` (static server + Playwright; copy from here).
4. `"capture": "node scripts/capture.mjs"` in `package.json`.
5. Pick 3–6 scenes: a hero + one per headline feature; prefer before/after rows.
6. `npm run build && npm run capture`; eyeball each `assets/*.png`.
7. Embed in the README with absolute raw URLs (+ `?v=1`), one per relevant section.
8. Commit `scripts/`, `assets/`, README. Keep `assets/` out of the package `files`.

---

## The prompt (paste version)

> Create targeted, reproducible README screenshots for this component library.
> Build a Playwright capture harness: `scripts/capture.html` imports the built
> bundle and renders a config-driven list of "scenes" (one DOM element per image,
> each a labelled component state; use before/after rows for feature comparisons),
> and `scripts/capture.mjs` serves the repo over HTTP, opens it in headless
> Chromium at `deviceScaleFactor: 2`, awaits `document.fonts.ready`, and
> `element.screenshot({ omitBackground: true })`s each scene to `assets/<id>.png`.
> Make the capture page background transparent and give scenes rounded dark cards
> so corners stay transparent (no white artifacts on dark READMEs). Add an
> `npm run capture` script. Then embed each image in its relevant README section
> via an absolute `raw.githubusercontent.com/<owner>/<repo>/<branch>/assets/<id>.png?v=1`
> URL. Pick a hero plus one image per headline feature. Don't ship `assets/` in
> the npm package.

---

## Refinement ideas (open questions for the skill)

- **Animated GIFs** for interactions (bar revealing, dragging a slider): record a
  Playwright video, transcode to GIF with ffmpeg (Playwright bundles one), or
  capture frames and assemble. Heavier; only where motion adds meaning.
- **Light + dark variants** of each image via `page.emulateMedia({ colorScheme })`,
  letting GitHub's `<picture>` + `prefers-color-scheme` swap them.
- **Visual-regression / CI capture:** run the harness in CI, diff against
  committed PNGs, fail on unexpected drift (and/or auto-commit refreshed images).
- **Auto alt-text** generated from the scene config (labels + options) for
  accessible, descriptive `alt` attributes.
- **Per-scene width/crop** controls and a shared theme token set, so the gallery
  stays visually consistent as scenes are added.
