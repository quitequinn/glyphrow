# React guide

React is an optional **peer dependency** (>=17). The `glyphrow/react`
entry wraps the dependency-free core in a component.

## Install

```bash
npm install glyphrow
# react / react-dom are peers you already have in a React app
```

```tsx
import { Glyphrow } from "glyphrow/react";
import "glyphrow/styles.css";
```

## Basic usage

```tsx
export function Demo() {
  return (
    <Glyphrow
      text="Typography"
      fontFamily="Inter"
      size={96}
      controls={{ size: true, tracking: true, weight: true, italic: true, features: true }}
    />
  );
}
```

`Glyphrow` accepts every [option](../README.md#options) as a prop, plus
`className` for the host element, `children` for [extra controls](#extra-controls)
and `instanceRef` for the core instance.

## Server rendering

The component renders the tester's **full markup** — the sample at its size,
in its family, with its features, and the controls bar — so it is in the
server HTML (Next.js App Router, Remix, `renderToString`…). There is no blank
area or layout jump, and the sample shows without JavaScript. After hydration
the core *adopts* that markup and only attaches behaviour; it never rebuilds
React's nodes.

- It works as a client component (`"use client"`): render it from a server
  component and it is server-rendered like any other client component.
- Element ids come from `useId`, so they match between server and client on
  React 18+. On React 17, pass a stable `idPrefix` when server rendering.
- With `size="fit"` the size is only known in the browser, so the server markup
  has no font size and the line is fitted after hydration.

## Reading state

```tsx
import { useState } from "react";
import { Glyphrow } from "glyphrow/react";
import type { GlyphrowState } from "glyphrow/react";

export function Demo() {
  const [state, setState] = useState<GlyphrowState | null>(null);
  return (
    <>
      <Glyphrow fontFamily="Inter" size={72} controls={{ weight: true }} onChange={setState} />
      <pre>{state && JSON.stringify(state, null, 2)}</pre>
    </>
  );
}
```

`onChange` is read from a ref internally, so updating it does not rebuild the
tester. The instance is rebuilt only when a **structural** option changes
(serialised via the option object) and is always torn down on unmount via
`destroy()`. `text` and `lang` are not structural: changing them replaces the
sample in place (keeping the instance), which is how a language-sample select
works.

## Extra controls

Children render inside the controls bar (after the built-in controls, or first
with `extraControlsPosition="start"`). They re-render with your component; the
tester is not rebuilt. Give an element the `glyphrow__control` class for the
bar's segment styling.

```tsx
const SAMPLES = [
  { lang: "en", label: "English", text: "Hamburgefonstiv" },
  { lang: "de", label: "Deutsch", text: "Grüße aus Köln" },
];

export function Tester() {
  const [i, setI] = useState(0);
  const [missing, setMissing] = useState("");
  return (
    <Glyphrow
      text={SAMPLES[i].text}
      lang={SAMPLES[i].lang}
      styles={styles}
      controls={{ style: true, size: true, features }}
      extraControlsPosition="start"
      onChange={(state) => setMissing(findMissing(state.text, state.style))}
    >
      <label className="glyphrow__control">
        <select aria-label="Sample text" value={i} onChange={(e) => setI(Number(e.target.value))}>
          {SAMPLES.map((s, n) => <option key={s.lang} value={n}>{s.label}</option>)}
        </select>
      </label>
      {missing && <p className="glyphrow__control my-missing">{missing}</p>}
    </Glyphrow>
  );
}
```

## The instance

`instanceRef` receives the core instance after mount (and `null` after
unmount), for `getState()`, `setText(text, lang?)` and `setStyle(style)`:

```tsx
const ref = useRef<GlyphrowCore | null>(null);
<Glyphrow instanceRef={ref} styles={styles} />;
ref.current?.setStyle("bold");
```

## Variable & colour fonts

Configure any axis by tag and enable sliders with `controls.axes` (`wght` uses
the weight control). For colour fonts, expose palettes with `controls.palette`.

```tsx
<Glyphrow
  fontFamily="Fraunces"
  size={120}
  variable={{
    wght: { min: 100, max: 900 },
    opsz: { min: 9, max: 144, default: 40, label: "Optical" },
  }}
  controls={{ weight: true, axes: true }}
  palette="normal"
  synthesis={false}
/>
```

See the [README](../README.md#variable--colour-fonts) for the full axis/palette/
synthesis reference. All exported types include `AxisConfig` and `VariableConfig`.

## TypeScript

All option and state types are exported from `glyphrow/react` and
`glyphrow`:

```ts
import type {
  GlyphrowOptions,
  GlyphrowState,
  ControlsConfig,
  FeatureTag,
} from "glyphrow";
```
