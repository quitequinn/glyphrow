// Framework-agnostic, dependency-free Glyphrow.
//
// Replaces the legacy jQuery/jQuery-UI/bigtext widget. Key differences:
//  - No eval, no innerHTML with user data — DOM is built with createElement and
//    textContent, styles via element.style (no string injection).
//  - Native, accessible controls: <input type=range>, <button aria-pressed>,
//    <select>, and checkbox-based feature toggles with a focus-managed panel.
//  - OpenType features compose (multiple active at once).
//  - Auto-fit via ResizeObserver (tracks container resizes) instead of bigtext.
//  - No global state; each instance owns its DOM, listeners and observers and is
//    fully torn down by destroy().

import { Fitter } from "./fit.js";
import { clamp, el, toNumber } from "./dom.js";
import {
	FEATURES,
	FEATURE_BY_TAG,
	type FeatureDef,
	type FeatureTag,
	featureLabel,
	featureSettings,
	isKnownFeature,
} from "./opentype.js";
import type {
	Align,
	AxisConfig,
	ControlsConfig,
	Range,
	GlyphrowOptions,
	GlyphrowState,
} from "./types.js";

/** Default slider ranges, overridable per control. */
const DEFAULT_RANGES = {
	size: { min: 8, max: 300, step: 1 },
	tracking: { min: -0.1, max: 0.5, step: 0.005 },
	weight: { min: 100, max: 900, step: 100 },
} as const;

const ALIGNS: readonly Align[] = ["left", "center", "right"];

// Monotonic counter for unique element ids (deterministic, collision-free even
// for instances created within the same millisecond).
let idCounter = 0;
function nextId(): number {
	return ++idCounter;
}

/** Resolves a boolean|Range control config against a default range. */
function resolveRange(value: boolean | Range | undefined, fallback: Range): Range | null {
	if (!value) return null;
	if (value === true) return { ...fallback };
	return { min: value.min, max: value.max, step: value.step ?? fallback.step };
}

/** A Glyphrow instance bound to a host element. */
export class Glyphrow {
	private readonly host: HTMLElement;
	private readonly options: GlyphrowOptions;
	private readonly controls: ControlsConfig;
	private readonly state: GlyphrowState;
	private readonly activeFeatures = new Set<FeatureTag>();
	private readonly cleanups: Array<() => void> = [];

	private typeEl!: HTMLElement;
	private textEl!: HTMLElement;
	private liveEl!: HTMLElement;
	private sizeOutput: HTMLOutputElement | null = null;
	private fitter: Fitter | null = null;
	// Last font spec passed to the Font Loading API, so we only request a face
	// when family/weight/style actually change (not on every size/tracking tick).
	private lastFontSpec = "";

	/**
	 * @param host Element to render the tester into.
	 * @param options Configuration; all fields optional.
	 */
	constructor(host: HTMLElement, options: GlyphrowOptions = {}) {
		this.host = host;
		this.options = options;
		this.controls = options.controls ?? {};

		const fit = options.size === "fit";
		for (const tag of options.features ?? []) {
			if (isKnownFeature(tag)) this.activeFeatures.add(tag);
		}
		// Initial value for every configured variable axis except wght (which the
		// weight control owns).
		const axes: Record<string, number> = {};
		for (const [tag, cfg] of Object.entries(options.variable ?? {})) {
			if (tag === "wght") continue;
			axes[tag] = clamp(cfg.default ?? cfg.min, cfg.min, cfg.max);
		}
		this.state = {
			text: options.text ?? "",
			size: fit ? 0 : toNumber(options.size, 80),
			fit,
			tracking: toNumber(options.tracking, 0),
			weight: toNumber(options.weight, 400),
			italic: options.italic ?? false,
			align: options.align ?? "left",
			wrap: options.wrap ?? true,
			features: Array.from(this.activeFeatures),
			axes,
			palette: options.palette ?? "normal",
		};

		this.render();
	}

	/** Returns a snapshot of the current state. */
	getState(): GlyphrowState {
		return {
			...this.state,
			features: Array.from(this.activeFeatures),
			axes: { ...this.state.axes },
		};
	}

	/** Removes all DOM, listeners and observers created by this instance. */
	destroy(): void {
		this.fitter?.destroy();
		this.fitter = null;
		for (const off of this.cleanups.splice(0)) off();
		this.host.replaceChildren();
	}

	// ---- rendering -------------------------------------------------------

	private render(): void {
		this.host.classList.add("glyphrow");
		if (this.options.showValues) this.host.classList.add("glyphrow--show-values");

		this.textEl = el("div", {
			class: "glyphrow__text",
			text: this.state.text,
			attrs: {
				role: "textbox",
				"aria-label": this.options.ariaLabel ?? "Sample text",
				"aria-multiline": String(this.state.wrap),
				contenteditable: this.options.editable !== false ? "true" : null,
				spellcheck: String(this.options.spellcheck ?? false),
				"data-placeholder": this.options.placeholder ?? "Type to test…",
			},
		});
		this.typeEl = el("div", { class: "glyphrow__type", children: [this.textEl] });
		const stage = el("div", { class: "glyphrow__stage", children: [this.typeEl] });

		this.liveEl = el("div", {
			class: "glyphrow__sr-only",
			attrs: { "aria-live": "polite", "aria-atomic": "true" },
		});

		const controls = this.buildControls();
		const children: Node[] = [stage];
		if (controls) children.push(controls);
		children.push(this.liveEl);
		this.host.replaceChildren(...children);

		if (this.options.editable !== false) this.wireEditable();
		this.applyStyles();
		this.setupFit();
	}

	private buildControls(): HTMLElement | null {
		const items: Node[] = [];
		const sizeRange = resolveRange(this.controls.size, DEFAULT_RANGES.size);
		if (sizeRange && !this.state.fit) items.push(this.buildSize(sizeRange));
		const trackingRange = resolveRange(this.controls.tracking, DEFAULT_RANGES.tracking);
		if (trackingRange) items.push(this.buildTracking(trackingRange));
		const weightRange = resolveRange(
			this.controls.weight,
			this.options.variable?.wght ?? DEFAULT_RANGES.weight,
		);
		if (weightRange) items.push(this.buildWeight(weightRange));
		for (const axis of this.buildAxes()) items.push(axis);
		if (this.controls.italic) items.push(this.buildItalic());
		if (this.controls.align) items.push(this.buildAlign());
		if (this.controls.wrap) items.push(this.buildWrap());
		if (this.controls.features) items.push(this.buildFeatures());
		if (this.controls.palette) items.push(this.buildPalette());

		if (items.length === 0) return null;
		return el("div", {
			class: "glyphrow__controls",
			attrs: { role: "group", "aria-label": "Typography controls" },
			children: items,
		});
	}

	// ---- generic control builders (no per-control copy-paste) -------------

	/**
	 * Builds the decorative caption overlaid on a control: the title, plus an
	 * optional value element shown only when `showValues` is set. Sits above the
	 * underlying input (z-index) and ignores pointer events so dragging works.
	 */
	private caption(title: string, value?: HTMLElement): HTMLSpanElement {
		const labelSpan = el("span", { class: "glyphrow__label", text: title });
		return el("span", {
			class: "glyphrow__caption",
			attrs: { "aria-hidden": "true" },
			children: value ? [labelSpan, value] : [labelSpan],
		});
	}

	private buildSlider(
		key: string,
		label: string,
		range: Range,
		value: number,
		unit: string,
		onInput: (value: number) => void,
	): HTMLElement {
		const output = el("output", { class: "glyphrow__value", text: `${value}${unit}` });
		const input = el("input", {
			class: `glyphrow__slider glyphrow__slider--${key}`,
			attrs: {
				type: "range",
				min: range.min,
				max: range.max,
				step: range.step ?? 1,
				value,
				"aria-label": label,
			},
		});
		// Expose the value as a 0–100% custom property so the stylesheet can paint
		// the filled portion of the track (a green/accent fill) without JS styling.
		const span = range.max - range.min || 1;
		const setFill = (v: number) =>
			input.style.setProperty("--glyphrow-fill", `${((v - range.min) / span) * 100}%`);
		setFill(value);
		const handler = () => {
			const v = Number(input.value);
			output.textContent = `${v}${unit}`;
			setFill(v);
			onInput(v);
			// No announce() here: a native range input already reports its value to
			// assistive tech, and announcing per tick floods the live region.
		};
		input.addEventListener("input", handler);
		this.cleanups.push(() => input.removeEventListener("input", handler));
		if (key === "size") this.sizeOutput = output;
		return el("label", {
			class: `glyphrow__control glyphrow__control--${key}`,
			children: [input, this.caption(label, output)],
		});
	}

	private buildSize(range: Range): HTMLElement {
		this.state.size = clamp(this.state.size, range.min, range.max);
		return this.buildSlider("size", "Size", range, this.state.size, "px", (v) => {
			this.state.size = v;
			this.applyStyles();
			this.emitChange();
		});
	}

	private buildTracking(range: Range): HTMLElement {
		this.state.tracking = clamp(this.state.tracking, range.min, range.max);
		return this.buildSlider(
			"tracking",
			"Tracking",
			range,
			this.state.tracking,
			"em",
			(v) => {
				this.state.tracking = v;
				this.applyStyles();
				this.emitChange();
			},
		);
	}

	private buildWeight(range: Range): HTMLElement {
		this.state.weight = clamp(this.state.weight, range.min, range.max);
		return this.buildSlider("weight", "Weight", range, this.state.weight, "", (v) => {
			this.state.weight = v;
			this.applyStyles();
			this.emitChange();
		});
	}

	/** Builds a slider for each configured variable axis (except wght). */
	private buildAxes(): HTMLElement[] {
		if (!this.controls.axes || !this.options.variable) return [];
		const want = Array.isArray(this.controls.axes) ? this.controls.axes : null;
		const out: HTMLElement[] = [];
		for (const [tag, cfg] of Object.entries(this.options.variable)) {
			if (tag === "wght") continue;
			if (want && !want.includes(tag)) continue;
			out.push(this.buildAxis(tag, cfg));
		}
		return out;
	}

	private buildAxis(tag: string, cfg: AxisConfig): HTMLElement {
		const range: Range = { min: cfg.min, max: cfg.max, step: cfg.step ?? 1 };
		const init = clamp(this.state.axes[tag] ?? cfg.default ?? cfg.min, cfg.min, cfg.max);
		this.state.axes[tag] = init;
		return this.buildSlider(`axis-${tag}`, cfg.label ?? tag, range, init, "", (v) => {
			this.state.axes[tag] = v;
			this.applyStyles();
			this.emitChange();
		});
	}

	private buildPalette(): HTMLElement {
		const opts = Array.isArray(this.controls.palette)
			? this.controls.palette
			: ["normal", "light", "dark"];
		const select = el("select", {
			class: "glyphrow__select glyphrow__select--palette",
			attrs: { "aria-label": "Palette" },
			children: opts.map((p) =>
				el("option", { text: p, attrs: { value: p, selected: p === this.state.palette } }),
			),
		});
		const value = el("span", { class: "glyphrow__value", text: this.state.palette });
		const handler = () => {
			this.state.palette = select.value;
			value.textContent = select.value;
			this.applyStyles();
			this.emitChange();
			this.announce(`Palette ${select.value}`);
		};
		select.addEventListener("change", handler);
		this.cleanups.push(() => select.removeEventListener("change", handler));
		return el("label", {
			class: "glyphrow__control glyphrow__control--palette",
			children: [select, this.caption("Palette", value)],
		});
	}

	private buildToggle(
		key: string,
		label: string,
		pressed: boolean,
		onToggle: (pressed: boolean) => void,
	): HTMLButtonElement {
		const button = el("button", {
			class: `glyphrow__toggle glyphrow__toggle--${key}`,
			// aria-pressed is a string-valued ARIA state and must always be present
			// ("false"), unlike boolean HTML attributes which are omitted when off.
			attrs: { type: "button", "aria-pressed": String(pressed), "aria-label": label },
			children: [this.caption(label)],
		});
		const handler = () => {
			const next = button.getAttribute("aria-pressed") !== "true";
			button.setAttribute("aria-pressed", String(next));
			onToggle(next);
			this.announce(`${label} ${next ? "on" : "off"}`);
		};
		button.addEventListener("click", handler);
		this.cleanups.push(() => button.removeEventListener("click", handler));
		return button;
	}

	private buildItalic(): HTMLElement {
		const button = this.buildToggle("italic", "Italic", this.state.italic, (on) => {
			this.state.italic = on;
			this.applyStyles();
			this.emitChange();
		});
		return el("div", { class: "glyphrow__control", children: [button] });
	}

	private buildWrap(): HTMLElement {
		const button = this.buildToggle("wrap", "Wrap", this.state.wrap, (on) => {
			this.state.wrap = on;
			this.textEl.setAttribute("aria-multiline", String(on));
			this.applyStyles();
			this.emitChange();
		});
		return el("div", { class: "glyphrow__control", children: [button] });
	}

	private buildAlign(): HTMLElement {
		const select = el("select", {
			class: "glyphrow__select glyphrow__select--align",
			attrs: { "aria-label": "Alignment" },
			children: ALIGNS.map((a) =>
				el("option", {
					text: a.charAt(0).toUpperCase() + a.slice(1),
					attrs: { value: a, selected: a === this.state.align },
				}),
			),
		});
		const value = el("span", { class: "glyphrow__value", text: this.state.align });
		const handler = () => {
			const v = select.value as Align;
			if (ALIGNS.includes(v)) {
				this.state.align = v;
				value.textContent = v;
				this.applyStyles();
				this.emitChange();
				this.announce(`Alignment ${v}`);
			}
		};
		select.addEventListener("change", handler);
		this.cleanups.push(() => select.removeEventListener("change", handler));
		return el("label", {
			class: "glyphrow__control glyphrow__control--align",
			children: [select, this.caption("Align", value)],
		});
	}

	private buildFeatures(): HTMLElement {
		const offered: readonly FeatureDef[] = Array.isArray(this.controls.features)
			? this.controls.features
					.filter(isKnownFeature)
					// Preserve each feature's real group/label from the registry rather
					// than flattening everything into "Alternates".
					.map((tag) => FEATURE_BY_TAG.get(tag) ?? { tag, label: featureLabel(tag), group: "Alternates" })
			: FEATURES;

		const panelId = `glyphrow-feat-${nextId()}`;
		const toggle = el("button", {
			class: "glyphrow__toggle glyphrow__toggle--features",
			attrs: {
				type: "button",
				"aria-label": "Features",
				// Disclosure pattern: aria-expanded + aria-controls. No aria-haspopup
				// (the panel is a group of checkboxes, not a menu or dialog).
				"aria-expanded": "false",
				"aria-controls": panelId,
			},
			children: [this.caption("Features")],
		});

		const checks = offered.map((f) => {
			const input = el("input", {
				attrs: { type: "checkbox", value: f.tag, checked: this.activeFeatures.has(f.tag) },
			});
			const onChange = () => this.toggleFeature(f.tag, input.checked);
			input.addEventListener("change", onChange);
			this.cleanups.push(() => input.removeEventListener("change", onChange));
			return el("label", {
				class: "glyphrow__feature",
				children: [input, el("span", { text: f.label })],
			});
		});

		const panel = el("div", {
			class: "glyphrow__panel",
			attrs: { id: panelId, role: "group", "aria-label": "OpenType features", hidden: true },
			children: checks,
		});

		const wrapper = el("div", {
			class: "glyphrow__control glyphrow__control--features",
			children: [toggle, panel],
		});

		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
				toggle.focus();
			}
		};
		const onOutside = (e: MouseEvent) => {
			if (!wrapper.contains(e.target as Node)) setOpen(false);
		};
		// Close when focus leaves the whole control (e.g. Tabbing past the last
		// checkbox) — relatedTarget is the element about to receive focus.
		const onFocusOut = (e: FocusEvent) => {
			if (!wrapper.contains(e.relatedTarget as Node | null)) setOpen(false);
		};
		// The document-level listeners exist ONLY while the panel is open, so a
		// page full of testers doesn't accumulate one handler per instance.
		const setOpen = (open: boolean) => {
			toggle.setAttribute("aria-expanded", String(open));
			panel.toggleAttribute("hidden", !open);
			if (open) {
				document.addEventListener("keydown", onKeydown);
				document.addEventListener("click", onOutside);
				wrapper.addEventListener("focusout", onFocusOut);
				panel.querySelector<HTMLInputElement>("input")?.focus();
			} else {
				document.removeEventListener("keydown", onKeydown);
				document.removeEventListener("click", onOutside);
				wrapper.removeEventListener("focusout", onFocusOut);
			}
		};
		const onToggleClick = () => setOpen(toggle.getAttribute("aria-expanded") !== "true");
		toggle.addEventListener("click", onToggleClick);
		this.cleanups.push(() => {
			toggle.removeEventListener("click", onToggleClick);
			// Also drop the open-state listeners in case we're destroyed while open.
			document.removeEventListener("keydown", onKeydown);
			document.removeEventListener("click", onOutside);
			wrapper.removeEventListener("focusout", onFocusOut);
		});

		return wrapper;
	}

	private toggleFeature(tag: FeatureTag, on: boolean): void {
		if (on) this.activeFeatures.add(tag);
		else this.activeFeatures.delete(tag);
		this.state.features = Array.from(this.activeFeatures);
		this.applyStyles();
		this.emitChange();
		this.announce(`${featureLabel(tag)} ${on ? "on" : "off"}`);
	}

	// ---- behaviour -------------------------------------------------------

	private wireEditable(): void {
		const handler = () => {
			this.state.text = this.textEl.textContent ?? "";
			if (this.state.fit) this.fitter?.schedule();
			this.emitChange();
		};
		this.textEl.addEventListener("input", handler);
		this.cleanups.push(() => this.textEl.removeEventListener("input", handler));
	}

	private setupFit(): void {
		if (!this.state.fit) return;
		const range = resolveRange(this.controls.size, DEFAULT_RANGES.size) ?? DEFAULT_RANGES.size;
		this.fitter = new Fitter(this.textEl, range.min, range.max);
		this.fitter.start((size) => {
			this.state.size = size;
			this.typeEl.style.fontSize = `${size}px`;
			if (this.sizeOutput) this.sizeOutput.textContent = `${size}px`;
		});
	}

	/** The tested family with quotes/backslashes stripped, safe to interpolate. */
	private get safeFamily(): string {
		return this.options.fontFamily?.replace(/["\\]/g, "").trim() ?? "";
	}

	/** Applies the full typographic state to the type element via element.style. */
	private applyStyles(): void {
		const s = this.typeEl.style;
		const family = this.safeFamily
			? `"${this.safeFamily}"${this.options.fallback ? `, ${this.options.fallback}` : ", sans-serif"}`
			: (this.options.fallback ?? "sans-serif");
		s.fontFamily = family;
		if (!this.state.fit) s.fontSize = `${this.state.size}px`;
		s.letterSpacing = `${this.state.tracking}em`;
		s.fontStyle = this.state.italic ? "italic" : "normal";
		s.textAlign = this.state.align;
		this.textEl.style.whiteSpace = this.state.wrap ? "normal" : "nowrap";

		// Compose every variable axis into a single font-variation-settings value:
		// wght (driven by the weight control) plus any other configured axes.
		const varParts: string[] = [];
		if (this.options.variable?.wght) varParts.push(`"wght" ${this.state.weight}`);
		for (const [tag, v] of Object.entries(this.state.axes)) varParts.push(`"${tag}" ${v}`);
		s.fontVariationSettings = varParts.length ? varParts.join(", ") : "normal";
		s.fontWeight = String(this.state.weight);

		// Colour fonts: select the COLR/CPAL palette.
		s.setProperty("font-palette", this.state.palette);
		// If opsz is driven manually, stop auto optical-sizing from overriding it;
		// otherwise keep the browser default (auto) so it isn't left off.
		s.setProperty("font-optical-sizing", this.state.axes.opsz !== undefined ? "none" : "auto");
		// Honest proofing: optionally disable faux bold/italic/small-caps.
		if (this.options.synthesis === false) s.setProperty("font-synthesis", "none");

		const settings = featureSettings(this.activeFeatures);
		s.fontFeatureSettings = settings;
		// Older Safari needs the prefixed property; modern engines ignore it.
		s.setProperty("-webkit-font-feature-settings", settings);

		this.loadFont();

		// Auto-fit sizes to the rendered advance width, which weight, tracking,
		// features, italic and axis changes all affect. Re-fit so the sample keeps
		// filling its box instead of overflowing (and being clipped by the stage).
		// No-op until the Fitter exists (initial render calls this before setupFit).
		if (this.state.fit) this.fitter?.schedule();
	}

	/**
	 * Asks the browser to load the exact face for the current family, weight and
	 * style so toggling italic or changing weight uses the real glyphs instead of
	 * a fallback (which can look heavier/wrong until the face arrives). No-op when
	 * no family is set or the Font Loading API is unavailable.
	 */
	private loadFont(): void {
		const family = this.safeFamily;
		const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
		if (!family || !fonts?.load) return;
		const style = this.state.italic ? "italic" : "normal";
		const spec = `${style} ${this.state.weight} 1em "${family}"`;
		// Only request a face when the spec actually changes; size/tracking edits
		// run applyStyles too but don't affect which face is needed.
		if (spec === this.lastFontSpec) return;
		this.lastFontSpec = spec;
		try {
			fonts.load(spec).catch(() => {});
		} catch {
			/* invalid font shorthand — ignore */
		}
	}

	private announce(message: string): void {
		this.liveEl.textContent = message;
	}

	private emitChange(): void {
		this.options.onChange?.(this.getState());
	}
}
