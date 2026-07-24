// Public option and state types for the Glyphrow core.

import type { FeatureTag } from "./opentype.js";

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
	 * an array restricts the offered features to the given tags.
	 */
	features?: boolean | FeatureTag[];
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

/** Options accepted by {@link Glyphrow}. All fields are optional. */
export interface GlyphrowOptions {
	/** Initial sample text. */
	text?: string;
	/** Primary font-family name to test. */
	fontFamily?: string;
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
	/** Initially active OpenType feature tags. */
	features?: FeatureTag[];
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
	/** Active OpenType feature tags. */
	features: FeatureTag[];
	/** Current value per configured variable axis (excluding `wght`). */
	axes: Record<string, number>;
	/** Current colour-font palette (`font-palette`). */
	palette: string;
}

/** @deprecated Renamed to {@link GlyphrowOptions}. */
export type FontProofOptions = GlyphrowOptions;

/** @deprecated Renamed to {@link GlyphrowState}. */
export type FontProofState = GlyphrowState;
