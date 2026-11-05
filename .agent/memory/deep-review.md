# Panel Review — Project Specialists

Saved: 2026-06-15

## Specialists
1. Font / Variable Font Engineer — detected: font-feature-settings usage, vendor-prefixed feature settings, weightselection axis-like UI
2. Glyph / Typography Engineer — detected: OpenType feature tag table (liga/dlig/smcp/c2sc/onum/frac/ss0x/swsh), type sizing
3. Browser Layout Engineer — detected: bigtext auto-fit, window.load/keyup re-fit, layout read-then-write hot paths
4. Deep Accessibility Specialist — detected: contenteditable editor, spellcheck=false, slider keyboard interaction, no ARIA

(Animation Engineer detected but excluded by user on 2026-06-15.)

## Known intentional patterns
- Compose-everything OpenType model: the tester intentionally lets logically
  mutually-exclusive features (e.g. lnum/onum, pnum/tnum) be active at once and
  leaves resolution to the browser/font. Not a bug.
- Auto-fit measures a single (nowrap) line even when wrap mode is on; it fits the
  unwrapped width. Intentional definition of "fit".
- When a variable `wght` axis is configured, both `font-variation-settings: "wght"`
  and `font-weight` are set — the latter is an intentional fallback for
  non-variable fonts.
- The React wrapper keys instance rebuilds on `JSON.stringify(options)` and reads
  `onChange` via a ref (so changing the callback does not rebuild). Intentional.
- The original v1 jQuery widget lives at the `v1.0.0` git tag (the `legacy/`
  folder was removed after v2 shipped). It is not the shipped module and should
  not be reviewed as product code.

## Known intentional patterns (FontProof v2.x)
- `loadFont()` lives inside `applyStyles()` but is deduped by the `${style} ${weight} 1em "${family}"` spec, so it does NOT hit the network per slider tick. Don't re-flag "network I/O in styling" or "load per tick".
- Sliders intentionally do NOT push to the live region — native `<input type=range>` reports its value to AT. Don't re-flag "missing slider announce".
- `overflow: hidden` on `.fp__stage` is a deliberate, user-requested choice (contains overflowing large type). Don't re-flag glyph/swash clipping.
- Control bar height (`--fp-bar-h: 26px`) is a deliberate design choice, below WCAG 2.5.5 AAA 44px. Don't re-flag touch-target size.
- Variable-font axis support is intentionally `wght`-only for now (scope), even though demos load `opsz`. Not a bug.
- `.fp__caption` is `aria-hidden`; the value/state is conveyed by the native control (range/select/checkbox). Not an a11y gap.
- `mix-blend-mode: difference` on bar titles is intentional; contrast for *custom* `--fp-bar-fill` values is the consumer's responsibility (defaults verified).
- The bar is hidden via `opacity/max-height/pointer-events` and revealed on `.fp:focus-within` — controls stay in the tab order; tabbing in reveals the bar. Intentional.

## History
- 2026-06-15/16: Full panel review of legacy v1 → 36 issues (#2–#37). Rewrote as
  dependency-free npm module (v2) on branch `rewrite/npm-module`; all 36 issues
  closed as resolved-by-rewrite. Second panel pass fixed: ResizeObserver height
  feedback loop, restricted-features grouping, deterministic ids, document-level
  Escape, aria-multiline string value. 37 tests passing.

## Architecture since 3.1.0 (2026-11-04)
- Markup is described once in `src/core/view.ts` (`resolveModel` → `buildView` → VNode tree)
  and rendered three ways: `toDOM` (vanilla core), `toHTML`/`renderHTML` (server string),
  and `toReact` in the React wrapper. Keep all three in step by changing only the view.
- The core either builds the view into the host or adopts existing markup (host has
  `data-glyphrow-rendered`), then wires behaviour by class name. `destroy()` leaves adopted
  markup in place — intentional, so React/SSR-owned nodes are never removed by the core.
- React memoises the converted tree per structural-options key; the `children` slot reads
  from a context so it re-renders without touching core-owned DOM. Do not move nodes the
  core adopted: style switches show/hide axis sliders via `hidden` and attributes only.
- Class names and `--glyphrow-*` variables are a documented, stable theming API (README).
- PR #62 review fixes (2026-11-05): adoption now resets controls to the new instance's
  state (`syncControls`); `font-palette` is whitelisted and `toHTML` drops style values with
  `;{}`; numeric style refs use the original `styles` index; duplicate style values get
  `-<index>`; touched axis values persist through styles lacking the axis; axis values snap
  to `step`; samples carry the shown face (`sampleStyle`); `state.features` uses each
  feature's `tag` (`builtInTags`); `renderHTML` ids default to `glyphrow-ssr-N`.
- The live region was removed in 3.0.9 (native controls report their own values); the
  README's old "polite live region" line was corrected in 3.1.0.
