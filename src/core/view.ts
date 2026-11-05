// The tester's markup as data: options are resolved once into a Model, and the
// Model is described as a tree of VNodes. The same tree is built into DOM by
// the vanilla core, serialised to HTML for server rendering, and rendered by
// the React wrapper — so every renderer produces identical markup and the core
// can adopt server-rendered markup instead of rebuilding it.

import { clamp, toNumber } from "./dom.js";
import {
	FEATURES,
	builtInTags,
	composeFeatureSettings,
	resolveFeature,
	type ResolvedFeature,
} from "./opentype.js";
import type {
	Align,
	ControlsConfig,
	GlyphrowOptions,
	GlyphrowState,
	Range,
	VariableConfig,
} from "./types.js";

/** Attribute values a VNode carries; nullish/false are omitted, true is an empty attribute. */
export type VAttrs = Record<string, string | number | boolean | null | undefined>;

/** A framework-neutral element description. */
export interface VNode {
	/** Tag name. */
	tag: string;
	/** Attributes, including `class`. */
	attrs: VAttrs;
	/** Inline style as CSS property names (kebab-case, custom properties allowed). */
	style?: Record<string, string>;
	/** Text content (escaped by every renderer). */
	text?: string;
	/** Child elements. */
	children?: VNode[];
	/** Marks the extra-controls slot, which renderers fill with host content. */
	slot?: true;
}

/** Default slider ranges, overridable per control. */
export const DEFAULT_RANGES = {
	size: { min: 8, max: 300, step: 1 },
	tracking: { min: -0.1, max: 0.5, step: 0.005 },
	weight: { min: 100, max: 900, step: 100 },
} as const;

/** Alignment values the align control offers. */
export const ALIGNS: readonly Align[] = ["left", "center", "right"];

/** A validated style from the `styles` option. */
export interface ResolvedStyle {
	/** Position in the `styles` option as given (numeric style references use it). */
	index: number;
	/** Stable identifier (the given value, or the index as a string); unique within the model. */
	value: string;
	/** Name shown in the select. */
	label: string;
	/** CSS family, quote-stripped. */
	family: string;
	/** font-weight to set, if given. */
	weight?: number;
	/** Whether to set font-style: italic. */
	italic?: boolean;
	/** Variable axes of the style (including wght). */
	axes: VariableConfig;
}

/** Options resolved into everything the renderers and the core need. */
export interface Model {
	/** The options as given. */
	options: GlyphrowOptions;
	/** The controls config (empty when none). */
	controls: ControlsConfig;
	/** Prefix for element ids. */
	idPrefix: string;
	/** Valid styles (empty without the `styles` option). */
	styles: ResolvedStyle[];
	/** Features the features control offers (empty without one). */
	offered: ResolvedFeature[];
	/** Features active at start, in order. */
	initialActive: ResolvedFeature[];
	/** Whether the features panel is grouped (some offered feature has a group). */
	grouped: boolean;
	/** Size slider range, or null when there is no size slider. */
	sizeRange: Range | null;
	/** Tracking slider range, or null. */
	trackingRange: Range | null;
	/** Weight slider range, or null (always null in styles mode). */
	weightRange: Range | null;
	/** Range auto-fit clamps to. */
	fitRange: Range;
	/** Axis tags that get a slider, in order. */
	axisTags: string[];
	/** Initial state. */
	state: GlyphrowState;
}

/** Resolves a boolean|Range control config against a default range. */
function resolveRange(value: boolean | Range | undefined, fallback: Range): Range | null {
	if (!value) return null;
	if (value === true) return { ...fallback };
	return { min: value.min, max: value.max, step: value.step ?? fallback.step };
}

/** Strips quotes, backslashes and CSS/HTML delimiters from a family name so it can be quoted safely. */
export function safeFamilyName(family: string | undefined): string {
	return family?.replace(/["\\;{}<>]/g, "").trim() ?? "";
}

/** A `font-palette` value the tester accepts: normal, light, dark or a `--custom` palette name. */
const PALETTE_RE = /^(?:normal|light|dark|--[A-Za-z_][\w-]*)$/;

/** Whether a value is an accepted `font-palette` value (anything else could carry CSS). */
export function isSafePalette(value: unknown): value is string {
	return typeof value === "string" && PALETTE_RE.test(value);
}

/**
 * Moves a slider value to the nearest step the browser allows, as a range
 * input does: clamped to [min, max], then snapped to min + n*step (never above max).
 */
export function snapToStep(value: number, range: Range): number {
	const step = range.step && range.step > 0 ? range.step : 1;
	const decimals = Math.max(decimalsOf(step), decimalsOf(range.min));
	const round = (v: number) => Number(v.toFixed(decimals));
	let v = round(range.min + Math.round((clamp(value, range.min, range.max) - range.min) / step) * step);
	if (v > range.max) v = round(v - step);
	return clamp(v, range.min, range.max);
}

/** Number of decimal places in a number's shortest form. */
function decimalsOf(n: number): number {
	const text = String(n);
	const exp = /e-(\d+)$/.exec(text);
	if (exp) return Number(exp[1]);
	const dot = text.indexOf(".");
	return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * The variable axes in force for a style index: the style's own axes in
 * styles mode (falling back to `variable`), else `variable` without `wght`
 * (which the weight control owns).
 */
export function axesFor(model: Pick<Model, "styles" | "options">, styleIndex: number): VariableConfig {
	const style = model.styles[styleIndex];
	if (style) return style.axes;
	const out: VariableConfig = {};
	for (const [tag, cfg] of Object.entries(model.options.variable ?? {})) {
		if (tag !== "wght") out[tag] = cfg;
	}
	return out;
}

/** Index of the style an index-or-value reference names, or -1. */
export function findStyle(styles: readonly ResolvedStyle[], ref: number | string | undefined): number {
	if (ref == null) return -1;
	if (typeof ref === "number") return Number.isInteger(ref) ? styles.findIndex((s) => s.index === ref) : -1;
	return styles.findIndex((s) => s.value === ref);
}

/**
 * Resolves options into a {@link Model}: validated styles and features,
 * control ranges, and the clamped initial state.
 * @param options Tester options.
 * @param idPrefix Prefix for element ids (must match between server and client).
 */
export function resolveModel(options: GlyphrowOptions, idPrefix: string): Model {
	const controls = options.controls ?? {};

	const styles: ResolvedStyle[] = [];
	(options.styles ?? []).forEach((s, i) => {
		const family = safeFamilyName(s?.family);
		if (!family) return;
		// Values identify styles, so they must be unique: a repeat gets the index appended.
		let value = s.value != null ? String(s.value) : String(i);
		if (styles.some((t) => t.value === value)) {
			const unique = `${value}-${i}`;
			if (typeof console !== "undefined") {
				console.warn(`Glyphrow: duplicate style value "${value}", using "${unique}" for style ${i}`);
			}
			value = unique;
		}
		styles.push({
			index: i,
			value,
			label: s.label ?? family,
			family,
			...(s.weight != null && Number.isFinite(s.weight) ? { weight: s.weight } : {}),
			...(s.italic != null ? { italic: !!s.italic } : {}),
			axes: s.axes ?? options.variable ?? {},
		});
	});
	const stylesMode = styles.length > 0;
	const styleIndex = stylesMode ? Math.max(0, findStyle(styles, options.style)) : -1;
	const style = styles[styleIndex];

	// Features: the offered list, then the initially active ones (offered
	// default-on features start active, as they are on in the font).
	const offered: ResolvedFeature[] = [];
	if (controls.features) {
		const inputs = Array.isArray(controls.features) ? controls.features : FEATURES.map((f) => f.tag);
		const seen = new Set<string>();
		for (const input of inputs) {
			const f = resolveFeature(input);
			if (f && !seen.has(f.key)) {
				seen.add(f.key);
				offered.push(f);
			}
		}
	}
	const offeredByKey = new Map(offered.map((f) => [f.key, f]));
	const active = new Map<string, ResolvedFeature>();
	for (const input of options.features ?? []) {
		const f = resolveFeature(input);
		if (f && !active.has(f.key)) active.set(f.key, offeredByKey.get(f.key) ?? f);
	}
	for (const f of offered) if (f.defaultOn && !active.has(f.key)) active.set(f.key, f);
	const initialActive = Array.from(active.values());

	const fit = options.size === "fit";
	const sizeRange = resolveRange(controls.size, DEFAULT_RANGES.size);
	const trackingRange = resolveRange(controls.tracking, DEFAULT_RANGES.tracking);
	const weightRange = stylesMode
		? null
		: resolveRange(controls.weight, options.variable?.wght ?? DEFAULT_RANGES.weight);

	let size = fit ? 0 : toNumber(options.size, 80);
	if (sizeRange && !fit) size = clamp(size, sizeRange.min, sizeRange.max);
	let tracking = toNumber(options.tracking, 0);
	if (trackingRange) tracking = clamp(tracking, trackingRange.min, trackingRange.max);
	let weight = stylesMode ? (style!.weight ?? 400) : toNumber(options.weight, 400);
	if (weightRange) weight = clamp(weight, weightRange.min, weightRange.max);

	const axisConfig = axesFor({ styles, options }, styleIndex);
	const axes: Record<string, number> = {};
	for (const [tag, cfg] of Object.entries(axisConfig)) {
		axes[tag] = snapToStep(cfg.default ?? cfg.min, cfg);
	}

	// Axis sliders: every axis of the current config, or in styles mode the
	// union over all styles (those the shown style lacks are hidden).
	const axisTags: string[] = [];
	if (controls.axes) {
		const want = Array.isArray(controls.axes) ? controls.axes : null;
		const sources = stylesMode ? styles.map((s) => s.axes) : [axisConfig];
		for (const source of sources) {
			for (const tag of Object.keys(source)) {
				if (want && !want.includes(tag)) continue;
				if (!axisTags.includes(tag)) axisTags.push(tag);
			}
		}
	}

	const state: GlyphrowState = {
		text: options.text ?? "",
		size,
		fit,
		tracking,
		weight,
		italic: stylesMode ? (style!.italic ?? false) : (options.italic ?? false),
		align: options.align && ALIGNS.includes(options.align) ? options.align : "left",
		wrap: options.wrap ?? true,
		features: builtInTags(initialActive),
		featureKeys: initialActive.map((f) => f.key),
		axes,
		palette: isSafePalette(options.palette) ? options.palette : "normal",
		style: style ? style.value : null,
		lang: options.lang ?? null,
	};

	return {
		options,
		controls,
		idPrefix,
		styles,
		offered,
		initialActive,
		grouped: offered.some((f) => f.group),
		sizeRange: fit ? null : sizeRange,
		trackingRange,
		weightRange,
		fitRange: sizeRange ?? { ...DEFAULT_RANGES.size },
		axisTags,
		state,
	};
}

/** Index of the active style in the model, or -1 without styles. */
export function styleIndexOf(model: Model, state: GlyphrowState): number {
	return state.style == null ? -1 : findStyle(model.styles, state.style);
}

/** The CSS font-family value for the given state (tested family, then fallback). */
export function familyValue(model: Model, state: GlyphrowState): string {
	const style = model.styles[styleIndexOf(model, state)];
	const family = style ? style.family : safeFamilyName(model.options.fontFamily);
	// Strip characters that can never appear in a valid font-family value but
	// could break out of a raw-stylesheet context (the fallback may legitimately
	// contain commas, quotes and generic names, so only the truly invalid go).
	const fallback = model.options.fallback?.replace(/[;{}<>]/g, "").trim();
	return family ? `"${family}"${fallback ? `, ${fallback}` : ", sans-serif"}` : (fallback ?? "sans-serif");
}

/**
 * The inline style of the type element for a state: family, size, tracking,
 * weight, style, alignment, axes, palette and features. Used for the server
 * markup and for every live update, so both always agree.
 */
export function typeStyle(
	model: Model,
	state: GlyphrowState,
	active: Iterable<ResolvedFeature>,
): Record<string, string> {
	const s: Record<string, string> = {};
	s["font-family"] = familyValue(model, state);
	if (!state.fit) s["font-size"] = `${state.size}px`;
	s["letter-spacing"] = `${state.tracking}em`;
	s["font-style"] = state.italic ? "italic" : "normal";
	s["text-align"] = state.align;

	// Compose every variable axis into one font-variation-settings value: wght
	// (from the weight control, outside styles mode) plus every other axis.
	const parts: string[] = [];
	if (!model.styles.length && model.options.variable?.wght) parts.push(`"wght" ${state.weight}`);
	for (const [tag, v] of Object.entries(state.axes)) parts.push(`"${tag.replace(/[^A-Za-z0-9 ]/g, "")}" ${v}`);
	s["font-variation-settings"] = parts.length ? parts.join(", ") : "normal";
	s["font-weight"] = String(state.weight);

	// Colour fonts: select the COLR/CPAL palette.
	s["font-palette"] = state.palette;
	// If opsz is driven manually, stop auto optical sizing from overriding it.
	s["font-optical-sizing"] = state.axes.opsz !== undefined ? "none" : "auto";
	// Honest proofing: optionally disable faux bold/italic/small-caps.
	if (model.options.synthesis === false) s["font-synthesis"] = "none";

	const settings = composeFeatureSettings(active, model.offered);
	s["font-feature-settings"] = settings;
	// Older Safari needs the prefixed property; modern engines ignore it.
	s["-webkit-font-feature-settings"] = settings;
	return s;
}

/**
 * The inline style of a feature's sample: the shown face (family, weight,
 * style, axes) with that feature on, so it previews what the sample would
 * look like in the tester.
 */
export function sampleStyle(model: Model, state: GlyphrowState, feature: ResolvedFeature): Record<string, string> {
	const t = typeStyle(model, state, []);
	const s: Record<string, string> = {
		"font-family": t["font-family"]!,
		"font-weight": t["font-weight"]!,
		"font-style": t["font-style"]!,
		"font-variation-settings": t["font-variation-settings"]!,
		"font-feature-settings": feature.on,
	};
	if (t["font-synthesis"]) s["font-synthesis"] = t["font-synthesis"];
	return s;
}

/** The inline style of the editable text element (wrapping). */
export function textStyle(state: GlyphrowState): Record<string, string> {
	return { "white-space": state.wrap ? "normal" : "nowrap" };
}

/** The `--glyphrow-fill` percentage a slider shows for a value in a range. */
export function fillPercent(value: number, min: number, max: number): string {
	const span = max - min || 1;
	return `${((value - min) / span) * 100}%`;
}

/** Text of the features toggle's count: how many non-default features are on, or "". */
export function featureCount(model: Model, activeKeys: ReadonlySet<string>): string {
	const n = model.offered.filter((f) => !f.defaultOn && activeKeys.has(f.key)).length;
	return n > 0 ? `${n} on` : "";
}

// ---- tree building --------------------------------------------------------

/** Shorthand VNode constructor. */
function h(tag: string, attrs: VAttrs, children?: VNode[] | string, style?: Record<string, string>): VNode {
	const node: VNode = { tag, attrs };
	if (typeof children === "string") node.text = children;
	else if (children) node.children = children;
	if (style) node.style = style;
	return node;
}

/** The decorative caption (title + optional value) overlaid on a control. */
function caption(title: string, value?: VNode): VNode {
	const label = h("span", { class: "glyphrow__label" }, title);
	return h("span", { class: "glyphrow__caption", "aria-hidden": "true" }, value ? [label, value] : [label]);
}

/** A range slider control. */
function slider(key: string, label: string, range: Range, value: number, unit: string, extra: VAttrs = {}, hidden = false): VNode {
	const input = h(
		"input",
		{
			class: `glyphrow__slider glyphrow__slider--${key}`,
			type: "range",
			min: range.min,
			max: range.max,
			step: range.step ?? 1,
			value,
			"aria-label": label,
			...extra,
		},
		undefined,
		{ "--glyphrow-fill": fillPercent(value, range.min, range.max) },
	);
	const output = h("output", { class: "glyphrow__value" }, `${value}${unit}`);
	return h("label", { class: `glyphrow__control glyphrow__control--${key}`, hidden }, [input, caption(label, output)]);
}

/** An aria-pressed toggle control. */
function toggle(key: string, label: string, pressed: boolean): VNode {
	const button = h(
		"button",
		{ class: `glyphrow__toggle glyphrow__toggle--${key}`, type: "button", "aria-pressed": String(pressed), "aria-label": label },
		[caption(label)],
	);
	return h("div", { class: "glyphrow__control" }, [button]);
}

/** A native select control with a caption showing the chosen value. */
function select(key: string, label: string, title: string, options: { value: string; text: string }[], selected: string, shown: string): VNode {
	const sel = h(
		"select",
		{ class: `glyphrow__select glyphrow__select--${key}`, "aria-label": label },
		options.map((o) => h("option", { value: o.value, selected: o.value === selected }, o.text)),
	);
	return h("label", { class: `glyphrow__control glyphrow__control--${key}` }, [
		sel,
		caption(title, h("span", { class: "glyphrow__value" }, shown)),
	]);
}

/** The features disclosure: toggle button, then the (hidden) panel of checkboxes. */
function featuresControl(model: Model, state: GlyphrowState): VNode {
	const panelId = `${model.idPrefix}-features`;
	const activeKeys = new Set(state.featureKeys);
	const item = (f: (typeof model.offered)[number]): VNode => {
		const children: VNode[] = [
			h("input", { type: "checkbox", value: f.key, checked: activeKeys.has(f.key) }),
			h("span", { class: "glyphrow__feature-label" }, f.label),
		];
		if (f.sample) {
			children.push(
				h("span", { class: "glyphrow__feature-sample", "aria-hidden": "true" }, f.sample, sampleStyle(model, state, f)),
			);
		}
		return h("label", { class: "glyphrow__feature" }, children);
	};

	let items: VNode[];
	if (model.grouped) {
		// Groups in order of first appearance; ungrouped features go last, under "Other".
		const groups = new Map<string, VNode[]>();
		for (const f of model.offered) {
			const name = f.group ?? "Other";
			if (!groups.has(name)) groups.set(name, []);
			groups.get(name)!.push(item(f));
		}
		const other = groups.get("Other");
		groups.delete("Other");
		if (other) groups.set("Other", other);
		items = Array.from(groups, ([name, children]) =>
			h("fieldset", { class: "glyphrow__feature-group" }, [
				h("legend", { class: "glyphrow__feature-legend" }, name),
				...children,
			]),
		);
	} else {
		items = model.offered.map(item);
	}
	const reset = model.controls.featuresReset;
	if (reset) {
		items.push(
			h("button", { class: "glyphrow__reset", type: "button" }, typeof reset === "string" ? reset : "Reset"),
		);
	}

	const button = h(
		"button",
		{
			class: "glyphrow__toggle glyphrow__toggle--features",
			type: "button",
			"aria-label": "Features",
			// Disclosure pattern: aria-expanded + aria-controls, no aria-haspopup
			// (the panel is a group of checkboxes, not a menu or dialog).
			"aria-expanded": "false",
			"aria-controls": panelId,
		},
		[caption("Features", h("span", { class: "glyphrow__count" }, featureCount(model, activeKeys)))],
	);
	const panel = h(
		"div",
		{ class: "glyphrow__panel", id: panelId, role: "group", "aria-label": "OpenType features", hidden: true },
		items,
	);
	return h("div", { class: "glyphrow__control glyphrow__control--features" }, [button, panel]);
}

/** Options for {@link buildView}. */
export interface ViewOptions {
	/** Render the extra-controls slot (the host will fill it). */
	hasExtra?: boolean;
}

/**
 * Describes the whole tester for a model: the root (the host element itself),
 * the stage with the sample at its size, and the controls bar.
 * @param model The resolved model.
 * @param view Whether to include the extra-controls slot.
 */
export function buildView(model: Model, view: ViewOptions = {}): VNode {
	const { options, controls, state } = model;
	const styleIndex = styleIndexOf(model, state);

	const text = h(
		"div",
		{
			class: "glyphrow__text",
			role: "textbox",
			"aria-label": options.ariaLabel ?? "Sample text",
			"aria-multiline": String(state.wrap),
			contenteditable: options.editable !== false ? "true" : null,
			spellcheck: String(options.spellcheck ?? false),
			"data-placeholder": options.placeholder ?? "Type to test…",
			lang: state.lang,
			dir: options.dir,
		},
		state.text,
		textStyle(state),
	);
	const type = h("div", { class: "glyphrow__type" }, [text], typeStyle(model, state, model.initialActive));
	const stage = h("div", { class: "glyphrow__stage" }, [type]);

	const items: VNode[] = [];
	if (controls.style && model.styles.length > 1) {
		const current = model.styles[styleIndex]!;
		items.push(
			select(
				"style",
				"Style",
				"Style",
				model.styles.map((s) => ({ value: s.value, text: s.label })),
				current.value,
				current.label,
			),
		);
	}
	if (model.sizeRange) items.push(slider("size", "Size", model.sizeRange, state.size, "px"));
	if (model.trackingRange) items.push(slider("tracking", "Tracking", model.trackingRange, state.tracking, "em"));
	if (model.weightRange) items.push(slider("weight", "Weight", model.weightRange, state.weight, ""));
	const axisConfig = axesFor(model, styleIndex);
	for (const tag of model.axisTags) {
		const cfg = axisConfig[tag] ?? model.styles.map((s) => s.axes[tag]).find(Boolean)!;
		const value = state.axes[tag] ?? snapToStep(cfg.default ?? cfg.min, cfg);
		items.push(
			slider(
				`axis-${tag}`,
				cfg.label ?? tag,
				{ min: cfg.min, max: cfg.max, step: cfg.step ?? 1 },
				value,
				"",
				{ "data-axis": tag },
				!(tag in axisConfig),
			),
		);
	}
	if (controls.italic && !model.styles.length) items.push(toggle("italic", "Italic", state.italic));
	if (controls.align) {
		items.push(
			select(
				"align",
				"Alignment",
				"Align",
				ALIGNS.map((a) => ({ value: a, text: a.charAt(0).toUpperCase() + a.slice(1) })),
				state.align,
				state.align,
			),
		);
	}
	if (controls.wrap) items.push(toggle("wrap", "Wrap", state.wrap));
	if (controls.features && model.offered.length) items.push(featuresControl(model, state));
	if (controls.palette) {
		const palettes = Array.isArray(controls.palette) ? controls.palette.filter(isSafePalette) : ["normal", "light", "dark"];
		items.push(
			select("palette", "Palette", "Palette", palettes.map((p) => ({ value: p, text: p })), state.palette, state.palette),
		);
	}

	const hasExtra = view.hasExtra ?? options.extraControls != null;
	if (hasExtra) {
		const slot: VNode = { tag: "div", attrs: { class: "glyphrow__extra" }, slot: true };
		if (options.extraControlsPosition === "start") items.unshift(slot);
		else items.push(slot);
	}

	const children: VNode[] = [stage];
	if (items.length) {
		children.push(h("div", { class: "glyphrow__controls", role: "group", "aria-label": "Typography controls" }, items));
	}
	return h(
		"div",
		{
			class: options.showValues ? "glyphrow glyphrow--show-values" : "glyphrow",
			"data-glyphrow-rendered": "",
		},
		children,
	);
}
