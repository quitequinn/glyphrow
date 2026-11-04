// Framework-agnostic, dependency-free Glyphrow.
//
// Markup comes from the shared view (view.ts), so the vanilla build, the HTML
// string renderer and the React wrapper produce the same elements. The core
// either builds that markup into the host or adopts markup already there (from
// server rendering), then wires behaviour onto it by class name. Key traits:
//  - No eval, no innerHTML with user data — DOM is built with createElement and
//    textContent, styles via element.style (no string injection).
//  - Native, accessible controls: <input type=range>, <button aria-pressed>,
//    <select>, and checkbox-based feature toggles with a focus-managed panel.
//  - OpenType features compose (multiple active at once), with host labels.
//  - Per-style families: a style select switches family, weight and axes.
//  - Auto-fit via ResizeObserver (tracks container resizes).
//  - No global state; each instance owns its listeners and observers and is
//    fully torn down by destroy() (adopted markup is left in place).

import { Fitter } from "./fit.js";
import { clamp } from "./dom.js";
import { isKnownFeature, type FeatureTag, type ResolvedFeature } from "./opentype.js";
import { applyAttrs, toDOM } from "./markup.js";
import {
	ALIGNS,
	axesFor,
	buildView,
	featureCount,
	familyValue,
	fillPercent,
	findStyle,
	resolveModel,
	styleIndexOf,
	textStyle,
	typeStyle,
	type Model,
} from "./view.js";
import type { Align, GlyphrowOptions, GlyphrowState } from "./types.js";

// Monotonic counter for unique element ids (deterministic, collision-free even
// for instances created within the same millisecond).
let idCounter = 0;
function nextId(): number {
	return ++idCounter;
}

/** One axis slider's elements. */
interface AxisSlider {
	control: HTMLElement;
	input: HTMLInputElement;
	output: HTMLElement | null;
	label: HTMLElement | null;
}

/** A Glyphrow instance bound to a host element. */
export class Glyphrow {
	private readonly host: HTMLElement;
	private readonly options: GlyphrowOptions;
	private readonly model: Model;
	private readonly state: GlyphrowState;
	// Active features in the order they were turned on.
	private readonly active = new Map<string, ResolvedFeature>();
	// Axes the visitor has moved: kept across style switches (others reset to the new style's default).
	private readonly touchedAxes = new Set<string>();
	private readonly cleanups: Array<() => void> = [];
	// True when the markup came from the server (or React): destroy leaves it.
	private adopted = false;
	// Nodes this instance added to adopted markup (extra controls), removed on destroy.
	private readonly addedNodes: Node[] = [];

	private typeEl!: HTMLElement;
	private textEl!: HTMLElement;
	private sizeOutput: HTMLElement | null = null;
	private styleSelect: HTMLSelectElement | null = null;
	private styleValue: HTMLElement | null = null;
	private countEl: HTMLElement | null = null;
	private featureChecks: HTMLInputElement[] = [];
	private sampleEls: HTMLElement[] = [];
	private readonly axisSliders = new Map<string, AxisSlider>();
	private fitter: Fitter | null = null;
	// Last font spec passed to the Font Loading API, so we only request a face
	// when family/weight/style actually change (not on every size/tracking tick).
	private lastFontSpec = "";
	// rAF handle so rapid slider input coalesces to one restyle per frame.
	private applyFrame = 0;

	/**
	 * @param host Element to render the tester into, or that already holds its
	 *   server-rendered markup (see `hydrate`).
	 * @param options Configuration; all fields optional.
	 */
	constructor(host: HTMLElement, options: GlyphrowOptions = {}) {
		this.host = host;
		this.options = options;
		this.model = resolveModel(options, options.idPrefix ?? `glyphrow-${nextId()}`);
		this.state = { ...this.model.state, axes: { ...this.model.state.axes } };
		for (const f of this.model.initialActive) this.active.set(f.key, f);

		const canAdopt =
			options.hydrate !== false &&
			host.hasAttribute("data-glyphrow-rendered") &&
			!!host.querySelector(".glyphrow__type") &&
			!!host.querySelector(".glyphrow__text");
		if (canAdopt) this.adopted = true;
		else this.build();

		this.wire();
		this.applyStyles();
		this.setupFit();
		this.mountExtra();
	}

	/** Returns a snapshot of the current state. */
	getState(): GlyphrowState {
		const keys = Array.from(this.active.keys());
		return {
			...this.state,
			features: keys.filter((k): k is FeatureTag => isKnownFeature(k)),
			featureKeys: keys,
			axes: { ...this.state.axes },
		};
	}

	/**
	 * Replaces the sample text, e.g. with a language sample, and optionally its
	 * language (`lang`): a string sets it, null removes it, omitted keeps it.
	 */
	setText(text: string, lang?: string | null): void {
		this.state.text = text;
		this.textEl.textContent = text;
		if (lang !== undefined) {
			this.state.lang = lang;
			if (lang) this.textEl.setAttribute("lang", lang);
			else this.textEl.removeAttribute("lang");
		}
		if (this.state.fit) this.fitter?.schedule();
		this.emitChange();
	}

	/** Switches to a style (by index into `styles`, or its `value`). No-op without styles. */
	setStyle(style: number | string): void {
		const index = findStyle(this.model.styles, style);
		const next = this.model.styles[index];
		if (!next || next.value === this.state.style) return;
		this.state.style = next.value;
		this.state.weight = next.weight ?? 400;
		this.state.italic = next.italic ?? false;

		// Axes: the new style's own coordinates, except axes the visitor moved,
		// which keep their value (clamped to the new range).
		const config = axesFor(this.model, index);
		const axes: Record<string, number> = {};
		for (const [tag, cfg] of Object.entries(config)) {
			const kept = this.touchedAxes.has(tag) ? this.state.axes[tag] : undefined;
			axes[tag] = clamp(kept ?? cfg.default ?? cfg.min, cfg.min, cfg.max);
		}
		this.state.axes = axes;
		for (const [tag, slider] of this.axisSliders) {
			const cfg = config[tag];
			slider.control.hidden = !cfg;
			if (!cfg) continue;
			const label = cfg.label ?? tag;
			slider.input.min = String(cfg.min);
			slider.input.max = String(cfg.max);
			slider.input.step = String(cfg.step ?? 1);
			slider.input.value = String(axes[tag]);
			slider.input.setAttribute("aria-label", label);
			if (slider.label) slider.label.textContent = label;
			this.syncSlider(slider.input, slider.output, axes[tag]!, "");
		}

		if (this.styleSelect && this.styleSelect.value !== next.value) this.styleSelect.value = next.value;
		if (this.styleValue) this.styleValue.textContent = next.label;
		const family = familyValue(this.model, this.state);
		for (const sample of this.sampleEls) sample.style.setProperty("font-family", family);
		this.applyStyles();
		this.emitChange();
	}

	/** Removes all listeners and observers; built markup is removed, adopted markup is left in place. */
	destroy(): void {
		if (this.applyFrame) cancelAnimationFrame(this.applyFrame);
		this.fitter?.destroy();
		this.fitter = null;
		for (const off of this.cleanups.splice(0)) off();
		if (this.adopted) {
			for (const node of this.addedNodes.splice(0)) node.parentNode?.removeChild(node);
		} else {
			this.host.replaceChildren();
			this.host.removeAttribute("data-glyphrow-rendered");
		}
	}

	// ---- markup ------------------------------------------------------------

	/** Builds the view's markup into the host (its root becomes the host). */
	private build(): void {
		const root = buildView(this.model);
		const { class: classes, ...attrs } = root.attrs;
		for (const name of String(classes ?? "").split(" ").filter(Boolean)) this.host.classList.add(name);
		applyAttrs(this.host, { ...root, attrs });
		this.host.replaceChildren(...(root.children ?? []).map(toDOM));
	}

	/** Finds an element inside the host. */
	private find<T extends HTMLElement = HTMLElement>(selector: string): T | null {
		return this.host.querySelector<T>(selector);
	}

	/** Adds an event listener and records its removal for destroy(). */
	private on<K extends keyof HTMLElementEventMap>(
		target: HTMLElement,
		type: K,
		handler: (event: HTMLElementEventMap[K]) => void,
	): void {
		target.addEventListener(type, handler);
		this.cleanups.push(() => target.removeEventListener(type, handler));
	}

	/** Attaches behaviour to every control present in the markup. */
	private wire(): void {
		this.typeEl = this.find(".glyphrow__type")!;
		this.textEl = this.find(".glyphrow__text")!;
		if (this.options.editable !== false) this.wireEditable();

		this.wireSlider("size", "px", (v) => (this.state.size = v));
		this.sizeOutput = this.find(".glyphrow__control--size .glyphrow__value");
		this.wireSlider("tracking", "em", (v) => (this.state.tracking = v));
		this.wireSlider("weight", "", (v) => (this.state.weight = v));
		for (const input of this.host.querySelectorAll<HTMLInputElement>(".glyphrow__slider[data-axis]")) {
			const tag = input.dataset.axis!;
			const control = input.closest<HTMLElement>(".glyphrow__control") ?? input;
			this.axisSliders.set(tag, {
				control,
				input,
				output: control.querySelector(".glyphrow__value"),
				label: control.querySelector(".glyphrow__label"),
			});
			this.wireRange(input, "", (v) => {
				this.state.axes[tag] = v;
				this.touchedAxes.add(tag);
			});
		}

		this.wireToggle("italic", (on) => (this.state.italic = on));
		this.wireToggle("wrap", (on) => {
			this.state.wrap = on;
			this.textEl.setAttribute("aria-multiline", String(on));
		});

		this.wireSelect("align", (v) => {
			if (!ALIGNS.includes(v as Align)) return false;
			this.state.align = v as Align;
			return true;
		});
		this.wireSelect("palette", (v) => {
			this.state.palette = v;
			return true;
		});
		this.styleSelect = this.find(".glyphrow__select--style");
		this.styleValue = this.find(".glyphrow__control--style .glyphrow__value");
		if (this.styleSelect) {
			const select = this.styleSelect;
			this.on(select, "change", () => this.setStyle(select.value));
		}

		this.wireFeatures();
	}

	/** Wires a named built-in slider (size/tracking/weight), if present. */
	private wireSlider(key: string, unit: string, set: (value: number) => void): void {
		const input = this.find<HTMLInputElement>(`.glyphrow__slider--${key}`);
		if (input) this.wireRange(input, unit, set);
	}

	/** Updates a slider's value readout and track fill. */
	private syncSlider(input: HTMLInputElement, output: HTMLElement | null, value: number, unit: string): void {
		if (output) output.textContent = `${value}${unit}`;
		input.style.setProperty("--glyphrow-fill", fillPercent(value, Number(input.min), Number(input.max)));
	}

	/** Wires a range input: readout, fill, state update and a batched restyle. */
	private wireRange(input: HTMLInputElement, unit: string, set: (value: number) => void): void {
		const output = input.closest(".glyphrow__control")?.querySelector<HTMLElement>(".glyphrow__value") ?? null;
		this.on(input, "input", () => {
			const v = Number(input.value);
			this.syncSlider(input, output, v, unit);
			set(v);
			this.scheduleApply();
			this.emitChange();
			// No live-region announcement: a native range input already reports
			// its value to assistive tech, and announcing per tick floods it.
		});
	}

	/** Wires an aria-pressed toggle button, if present. */
	private wireToggle(key: string, set: (on: boolean) => void): void {
		const button = this.find<HTMLButtonElement>(`.glyphrow__toggle--${key}`);
		if (!button) return;
		this.on(button, "click", () => {
			const next = button.getAttribute("aria-pressed") !== "true";
			button.setAttribute("aria-pressed", String(next));
			set(next);
			this.applyStyles();
			this.emitChange();
		});
	}

	/** Wires a select whose caption shows the chosen value. `set` returns false to reject. */
	private wireSelect(key: string, set: (value: string) => boolean): void {
		const select = this.find<HTMLSelectElement>(`.glyphrow__select--${key}`);
		if (!select) return;
		const value = select.closest(".glyphrow__control")?.querySelector<HTMLElement>(".glyphrow__value");
		this.on(select, "change", () => {
			if (!set(select.value)) return;
			if (value) value.textContent = select.value;
			this.applyStyles();
			this.emitChange();
		});
	}

	/** Wires the features disclosure: checkboxes, reset, and the panel's open/close. */
	private wireFeatures(): void {
		const wrapper = this.find(".glyphrow__control--features");
		const toggle = wrapper?.querySelector<HTMLButtonElement>(".glyphrow__toggle--features");
		const panel = wrapper?.querySelector<HTMLElement>(".glyphrow__panel");
		if (!wrapper || !toggle || !panel) return;
		this.countEl = toggle.querySelector(".glyphrow__count");
		this.sampleEls = Array.from(panel.querySelectorAll<HTMLElement>(".glyphrow__feature-sample"));
		const byKey = new Map(this.model.offered.map((f) => [f.key, f]));

		this.featureChecks = Array.from(panel.querySelectorAll<HTMLInputElement>(".glyphrow__feature input"));
		for (const input of this.featureChecks) {
			const feature = byKey.get(input.value);
			if (!feature) continue;
			this.on(input, "change", () => this.toggleFeature(feature, input.checked));
		}
		const reset = panel.querySelector<HTMLButtonElement>(".glyphrow__reset");
		if (reset) this.on(reset, "click", () => this.resetFeatures());

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
		this.on(toggle, "click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
		this.cleanups.push(() => {
			// Drop the open-state listeners in case we're destroyed while open.
			document.removeEventListener("keydown", onKeydown);
			document.removeEventListener("click", onOutside);
			wrapper.removeEventListener("focusout", onFocusOut);
		});
	}

	private toggleFeature(feature: ResolvedFeature, on: boolean): void {
		if (on) this.active.set(feature.key, feature);
		else this.active.delete(feature.key);
		this.featuresChanged();
	}

	/** Returns every offered feature to its initial state (non-offered ones are untouched). */
	private resetFeatures(): void {
		this.active.clear();
		for (const f of this.model.initialActive) this.active.set(f.key, f);
		for (const input of this.featureChecks) input.checked = this.active.has(input.value);
		this.featuresChanged();
	}

	private featuresChanged(): void {
		this.state.features = Array.from(this.active.keys()).filter((k): k is FeatureTag => isKnownFeature(k));
		this.state.featureKeys = Array.from(this.active.keys());
		if (this.countEl) this.countEl.textContent = featureCount(this.model, new Set(this.active.keys()));
		this.applyStyles();
		this.emitChange();
	}

	/** Mounts host-provided extra controls into the bar's slot. */
	private mountExtra(): void {
		const extra = this.options.extraControls;
		if (extra == null) return;
		let slot = this.find(".glyphrow__extra");
		if (!slot) {
			// Adopted markup rendered without a slot: add one.
			slot = document.createElement("div");
			slot.className = "glyphrow__extra";
			(this.find(".glyphrow__controls") ?? this.host).appendChild(slot);
			this.addedNodes.push(slot);
		}
		if (typeof extra === "function") {
			const cleanup = extra(slot, this);
			if (typeof cleanup === "function") this.cleanups.push(cleanup);
			return;
		}
		const nodes = Array.isArray(extra) ? extra : [extra];
		slot.append(...nodes);
		if (this.adopted) this.addedNodes.push(...nodes);
	}

	// ---- behaviour -----------------------------------------------------------

	private wireEditable(): void {
		this.on(this.textEl, "input", () => {
			this.state.text = this.textEl.textContent ?? "";
			if (this.state.fit) this.fitter?.schedule();
			this.emitChange();
		});
		if (this.options.plainPaste !== false) {
			this.on(this.textEl, "paste", (event) => this.pastePlain(event));
		}
	}

	/**
	 * Inserts pasted text as plain text on one line at the selection, so a
	 * paste never brings the source's fonts, colours or markup.
	 */
	private pastePlain(event: ClipboardEvent): void {
		const text = event.clipboardData?.getData("text/plain");
		const selection = typeof window !== "undefined" ? window.getSelection() : null;
		if (text == null || !selection || selection.rangeCount === 0) return;
		event.preventDefault();
		const range = selection.getRangeAt(0);
		range.deleteContents();
		const node = document.createTextNode(text.replace(/[\r\n\t]+/g, " "));
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		selection.removeAllRanges();
		selection.addRange(range);
		this.textEl.dispatchEvent(new Event("input", { bubbles: true }));
	}

	private setupFit(): void {
		if (!this.state.fit) return;
		const range = this.model.fitRange;
		this.fitter = new Fitter(this.textEl, range.min, range.max);
		this.fitter.start((size) => {
			this.state.size = size;
			this.typeEl.style.fontSize = `${size}px`;
			if (this.sizeOutput) this.sizeOutput.textContent = `${size}px`;
		});
	}

	/**
	 * Coalesces restyles to one per animation frame. Slider `input` fires many
	 * times per second during a drag, so batching avoids per-tick churn. Falls
	 * back to a synchronous apply where rAF isn't available.
	 */
	private scheduleApply(): void {
		if (typeof requestAnimationFrame === "undefined") {
			this.applyStyles();
			return;
		}
		if (this.applyFrame) return;
		this.applyFrame = requestAnimationFrame(() => {
			this.applyFrame = 0;
			this.applyStyles();
		});
	}

	/** Applies the full typographic state to the type element (the same values the server markup carries). */
	private applyStyles(): void {
		const s = this.typeEl.style;
		for (const [prop, value] of Object.entries(typeStyle(this.model, this.state, this.active.values()))) {
			s.setProperty(prop, value);
		}
		for (const [prop, value] of Object.entries(textStyle(this.state))) this.textEl.style.setProperty(prop, value);

		this.loadFont();

		// Auto-fit sizes to the rendered advance width, which weight, tracking,
		// features, italic and axis changes all affect, so re-fit after each.
		// No-op until the Fitter exists (the first apply runs before setupFit).
		if (this.state.fit) this.fitter?.schedule();
	}

	/**
	 * Asks the browser to load the exact face for the current family, weight and
	 * style so a change uses the real glyphs instead of a fallback. No-op when no
	 * family is set or the Font Loading API is unavailable.
	 */
	private loadFont(): void {
		const style = this.model.styles[styleIndexOf(this.model, this.state)];
		const family = style ? style.family : this.options.fontFamily?.replace(/["\\]/g, "").trim();
		const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
		if (!family || !fonts?.load) return;
		const spec = `${this.state.italic ? "italic" : "normal"} ${this.state.weight} 1em "${family}"`;
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

	private emitChange(): void {
		this.options.onChange?.(this.getState());
	}
}
