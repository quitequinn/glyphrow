// Public option and state types for the Glyphrow core.

import type { FeatureInput, FeatureTag } from "./opentype.js";

/** Text alignment values supported by the tester. */
export type Align = "left" | "center" | "right";

/** Size can be a fixed pixel value or "fit" to auto-fit the container width. */
export type Size = number | "fit";

/** Numeric range with optional step, used to configure slider controls. */
export interface Range {
	/** Minimum value (inclusive). */
	min: number;
	/** Maximum value (inclusive). */
	max: number;
	/** Step granularity. Defaults are control-specific. */
	step?: number;
}

/**
 * Which interactive controls to render, and optional range overrides. A boolean
 * toggles a control on/off with default ranges; an object enables it with a
 * custom range.
 */
export interface ControlsConfig {
	/** Font-size slider (px). Default range 8–300. */
	size?: boolean | Range;
	/** Letter-spacing slider (em). Default range -0.1–0.5. */
	tracking?: boolean | Range;
	/** Font-weight slider. Default range 100–900 step 100 (or the variable axis). */
	weight?: boolean | Range;
	/** Italic toggle button. */
	italic?: boolean;
	/** Alignment control. */
	align?: boolean;
	/** Line-wrap toggle button. */
	wrap?: boolean;
	/**
	 * OpenType feature controls. `true` exposes the full default feature list;
	 * an array offers exactly the given features — built-in tags, or
	 * {@link FeatureOption} objects with your own labels, any tag or raw
	 * settings, a group and a sample.
	 */
	features?: boolean | FeatureInput[];
	/**
	 * Adds a reset button to the features panel that turns every offered
	 * feature back to its initial state. `true` labels it "Reset"; a string
	 * sets the label.
	 */
	featuresReset?: boolean | string;
	/**
	 * Style select, switching between the families given in `styles`. Shown
	 * only when `styles` has two or more entries.
	 */
	style?: boolean;
	/**
	 * Variable-axis sliders (besides `wght`, which uses the weight control).
	 * `true` shows a slider for every axis configured in `variable`; an array
	 * restricts to the given axis tags.
	 */
	axes?: boolean | string[];
	/**
	 * Colour-font palette control (`font-palette`). `true` offers
	 * normal/light/dark; an array offers the given palette identifiers
	 * (e.g. custom `--name` palettes you define with `@font-palette-values`).
	 */
	palette?: boolean | string[];
}

/** Configuration for one variable-font axis. Extends a numeric {@link Range}. */
export interface AxisConfig extends Range {
	/** Initial value (defaults to `min`). */
	default?: number;
	/** Display label for the slider (defaults to the axis tag). */
	label?: string;
}

/**
 * Variable-font axis configuration, keyed by 4-character axis tag — registered
 * (`wght`, `wdth`, `opsz`, `slnt`, `ital`) or custom (`GRAD`, `SOFT`, `WONK`…).
 * Each configured axis is applied via `font-variation-settings`. `wght` is
 * special: it also drives the weight control.
 */
export type VariableConfig = Record<string, AxisConfig>;

/**
 * One style of a typeface served as its own CSS family (static or variable),
 * for the `styles` option.
 */
export interface StyleOption {
	/** Name shown in the style select, e.g. "Bold Italic". */
	label: string;
	/** The CSS font-family that renders this style. */
	family: string;
	/**
	 * Stable identifier reported in state and used as the option value. Defaults
	 * to the style's index as a string.
	 */
	value?: string;
	/**
	 * `font-weight` to set while this style is shown. Set it to match the
	 * family's `@font-face` weight; leave it unset when each family is a single
	 * face (it then renders at `normal`, never synthesised).
	 */
	weight?: number;
	/** Set `font-style: italic` while shown. Only when the family's `@font-face` declares italic. */
	italic?: boolean;
	/**
	 * Variable axes of this style (including `wght`), keyed by tag. Each axis's
	 * `default` is the style's own coordinate (e.g. a named instance), and
	 * `controls.axes` shows a slider per axis.
	 */
	axes?: VariableConfig;
}

/** Options accepted by {@link Glyphrow}. All fields are optional. */
export interface GlyphrowOptions {
	/** Initial sample text. */
	text?: string;
	/** Primary font-family name to test. Ignored when `styles` is given. */
	fontFamily?: string;
	/**
	 * Styles to switch between, each its own CSS family. When given, the active
	 * style sets the family, weight, italic and axes; the weight and italic
	 * controls are not rendered (the style control replaces them).
	 */
	styles?: StyleOption[];
	/** Initial style: an index into `styles`, or a style's `value`. Defaults to the first. */
	style?: number | string;
	/** Language of the sample text (`lang` on the text element), turning on the font's localised forms. */
	lang?: string;
	/** Text direction of the sample (`dir`), e.g. "auto" or "rtl". */
	dir?: "ltr" | "rtl" | "auto";
	/** Fallback font stack appended after the tested family. */
	fallback?: string;
	/** Initial size in px, or "fit" for auto-fit. */
	size?: Size;
	/** Initial letter-spacing in em. */
	tracking?: number;
	/** Initial font weight. */
	weight?: number;
	/** Initial italic state. */
	italic?: boolean;
	/** Initial alignment. */
	align?: Align;
	/** Whether text wraps (multi-line) or stays on a single line. */
	wrap?: boolean;
	/**
	 * Initially active OpenType features: built-in tags or {@link FeatureOption}
	 * objects. An active feature that the features control does not offer stays
	 * on (useful for a typeface's always-on settings).
	 */
	features?: FeatureInput[];
	/** Whether the sample text is user-editable. */
	editable?: boolean;
	/**
	 * Whether the browser spellchecks the editable sample. Off by default — a
	 * type specimen isn't prose, and red squiggles are visual noise.
	 */
	spellcheck?: boolean;
	/** Placeholder shown when the editable area is empty. */
	placeholder?: string;
	/** Which controls to render. Omit to show none (display-only). */
	controls?: ControlsConfig;
	/**
	 * Show each control's current value inline next to its title (e.g.
	 * "Size: 96px"). Off by default — only titles are shown.
	 */
	showValues?: boolean;
	/** Variable-font axis configuration (keyed by axis tag). */
	variable?: VariableConfig;
	/**
	 * Initial colour-font palette (`font-palette`): "normal", "light", "dark",
	 * or a custom `--name`. Defaults to "normal".
	 */
	palette?: string;
	/**
	 * Whether the browser may synthesise missing weights/styles (faux bold /
	 * faux italic / faux small-caps). Defaults to true. Set false for honest
	 * proofing — missing faces render as-is instead of being faked.
	 */
	synthesis?: boolean;
	/** Accessible label for the editable region. */
	ariaLabel?: string;
	/**
	 * Paste into the sample as plain text on one line (no source fonts or
	 * colours). Defaults to true.
	 */
	plainPaste?: boolean;
	/**
	 * Host controls added to the bar, after the built-in ones (or before, with
	 * `extraControlsPosition: "start"`). Give nodes, or a function that receives
	 * the slot element and the instance and may return a cleanup. Elements with
	 * the `glyphrow__control` class get the bar's segment styling.
	 */
	extraControls?:
		| Node
		| Node[]
		| ((slot: HTMLElement, instance: GlyphrowLike) => void | (() => void));
	/** Where the extra controls sit in the bar. Defaults to "end". */
	extraControlsPosition?: "start" | "end";
	/**
	 * Prefix for the element ids the tester writes (e.g. the features panel's).
	 * Server rendering and hydration must use the same prefix; the React
	 * wrapper sets it from `useId`.
	 */
	idPrefix?: string;
	/**
	 * Adopt markup already in the host (from server rendering) instead of
	 * building it. Defaults to adopting when the host carries
	 * `data-glyphrow-rendered`; false always rebuilds.
	 */
	hydrate?: boolean;
	/** Called whenever the typographic state changes. */
	onChange?: (state: GlyphrowState) => void;
}

/** The live typographic state of a tester instance. */
export interface GlyphrowState {
	/** Current text content. */
	text: string;
	/** Resolved size in px (the fitted size when in "fit" mode). */
	size: number;
	/** Whether the tester is auto-fitting. */
	fit: boolean;
	/** Letter-spacing in em. */
	tracking: number;
	/** Font weight. */
	weight: number;
	/** Italic state. */
	italic: boolean;
	/** Alignment. */
	align: Align;
	/** Whether text wraps. */
	wrap: boolean;
	/** Active built-in OpenType feature tags. */
	features: FeatureTag[];
	/** Every active feature's key: built-in or custom tags, `tag=value`, or canonical settings strings. */
	featureKeys: string[];
	/** The active style's `value` (index as a string by default), or null without `styles`. */
	style: string | null;
	/** The sample's language, or null. */
	lang: string | null;
	/** Current value per variable axis (excluding `wght`, unless it comes from a style's `axes`). */
	axes: Record<string, number>;
	/** Current colour-font palette (`font-palette`). */
	palette: string;
}

/** The instance surface handed to an `extraControls` function (avoids a circular import). */
export interface GlyphrowLike {
	/** Returns a snapshot of the current state. */
	getState(): GlyphrowState;
	/** Replaces the sample text (and optionally its language). */
	setText(text: string, lang?: string | null): void;
	/** Switches to a style by index or value. */
	setStyle(style: number | string): void;
}

/** @deprecated Renamed to {@link GlyphrowOptions}. */
export type FontProofOptions = GlyphrowOptions;

/** @deprecated Renamed to {@link GlyphrowState}. */
export type FontProofState = GlyphrowState;
