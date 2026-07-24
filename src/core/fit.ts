// Auto-fit engine. Replaces the legacy `bigtext` dependency.
//
// Sizing is computed by measuring the text once at a reference size in an
// offscreen mirror, then scaling linearly: glyph advances and em-based
// letter-spacing both scale linearly with font-size, so
//   fittedSize = referenceSize * containerWidth / measuredWidth
// is exact and needs a single read + write per fit (no read/write thrashing,
// no binary-search loop). Re-fitting is driven by ResizeObserver (so it tracks
// container resizes) and rAF-debounced (so typing does not thrash layout).

import { clamp } from "./dom.js";

const REFERENCE_SIZE = 100;

/** Font properties copied to the mirror so measurement matches the real text. */
const MIRROR_PROPS = [
	"fontFamily",
	"fontWeight",
	"fontStyle",
	"fontStretch",
	"letterSpacing",
	"fontFeatureSettings",
	"fontVariationSettings",
	"textTransform",
] as const;

/** Drives auto-fit sizing for a single text element. */
export class Fitter {
	private readonly target: HTMLElement;
	private readonly min: number;
	private readonly max: number;
	private mirror: HTMLSpanElement | null = null;
	private observer: ResizeObserver | null = null;
	private frame = 0;
	private onFit: ((size: number) => void) | null = null;
	private destroyed = false;
	// Last container width fitted against. Used to ignore ResizeObserver
	// notifications caused purely by height changes (a fit grows the line
	// height, which would otherwise re-trigger the observer in a loop).
	private lastWidth = -1;
	// The width fitted before `lastWidth` — used to break a 2-width oscillation
	// (e.g. our own resize toggling a scrollbar, flipping the width back and forth).
	private prevWidth = -1;

	/**
	 * @param target Element whose text is being fitted.
	 * @param min Minimum font-size in px.
	 * @param max Maximum font-size in px.
	 */
	constructor(target: HTMLElement, min: number, max: number) {
		this.target = target;
		this.min = min;
		this.max = max;
	}

	/**
	 * Starts observing the target's container and reports the fitted size via
	 * `onFit` whenever it should change. Re-fits once fonts have loaded.
	 */
	start(onFit: (size: number) => void): void {
		this.onFit = onFit;
		if (typeof ResizeObserver !== "undefined") {
			const container = this.target.parentElement ?? this.target;
			this.observer = new ResizeObserver(() => {
				// Only re-fit when the available width changes; height-only changes
				// are a consequence of fitting and must not feed back.
				if (container.clientWidth !== this.lastWidth) this.schedule();
			});
			this.observer.observe(container);
		}
		// Re-fit after web fonts load so we never measure fallback metrics.
		const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
		if (fonts?.ready) {
			fonts.ready.then(() => this.schedule()).catch(() => {});
		}
		this.schedule();
	}

	/** Requests a fit on the next animation frame, coalescing rapid calls. */
	schedule(): void {
		if (this.destroyed) return;
		if (typeof requestAnimationFrame === "undefined") {
			this.fit();
			return;
		}
		if (this.frame) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.fit();
		});
	}

	/** Measures the text and reports the fitted size. */
	private fit(): void {
		if (this.destroyed || !this.onFit) return;
		const container = this.target.parentElement ?? this.target;
		const width = container.clientWidth;
		if (width <= 0) return;
		// Bouncing back to the width we fitted two fits ago means our own resize is
		// oscillating (typically a scrollbar appearing/disappearing). Stop.
		if (width === this.prevWidth && width !== this.lastWidth) return;

		const mirror = this.ensureMirror();
		const computed = getComputedStyle(this.target);
		for (const prop of MIRROR_PROPS) {
			mirror.style[prop] = computed[prop];
		}
		mirror.style.fontSize = `${REFERENCE_SIZE}px`;
		mirror.textContent = this.target.textContent ?? "";

		const measured = mirror.getBoundingClientRect().width;
		if (measured <= 0) return;

		this.prevWidth = this.lastWidth;
		this.lastWidth = width;
		const size = clamp((REFERENCE_SIZE * width) / measured, this.min, this.max);
		this.onFit(Math.round(size * 100) / 100);
	}

	/** Lazily creates the shared offscreen measurement mirror. */
	private ensureMirror(): HTMLSpanElement {
		if (this.mirror) return this.mirror;
		const mirror = document.createElement("span");
		mirror.setAttribute("aria-hidden", "true");
		Object.assign(mirror.style, {
			position: "absolute",
			left: "-9999px",
			top: "0",
			visibility: "hidden",
			whiteSpace: "nowrap",
			pointerEvents: "none",
		});
		document.body.appendChild(mirror);
		this.mirror = mirror;
		return mirror;
	}

	/** Stops observing and removes the mirror. */
	destroy(): void {
		this.destroyed = true;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.observer?.disconnect();
		this.observer = null;
		this.mirror?.remove();
		this.mirror = null;
		this.onFit = null;
	}
}
