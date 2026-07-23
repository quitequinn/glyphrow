// React wrapper around the framework-agnostic Glyphrow core. React is a peer
// dependency, externalised at build time, so the core stays dependency-free.

import { useEffect, useRef } from "react";
import { Glyphrow as GlyphrowCore } from "../core/glyphrow.js";
import type { GlyphrowOptions, GlyphrowState } from "../core/types.js";

/** Props for {@link Glyphrow}. Mirrors {@link GlyphrowOptions}. */
export interface GlyphrowProps extends GlyphrowOptions {
	/** Class applied to the host element. */
	className?: string;
}

/**
 * Renders a {@link GlyphrowCore} into a host div. The instance is recreated when
 * any structural option changes and is always torn down on unmount.
 */
export function Glyphrow(props: GlyphrowProps): JSX.Element {
	const { className, onChange, ...options } = props;
	const hostRef = useRef<HTMLDivElement>(null);
	// Keep the latest onChange without forcing a tester rebuild on each render.
	const onChangeRef = useRef<((state: GlyphrowState) => void) | undefined>(onChange);
	onChangeRef.current = onChange;

	// Serialise structural options so the effect only re-runs on real changes.
	const key = JSON.stringify(options);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const instance = new GlyphrowCore(host, {
			...options,
			onChange: (state) => onChangeRef.current?.(state),
		});
		return () => instance.destroy();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return <div ref={hostRef} className={className} />;
}

/** @deprecated Renamed to {@link Glyphrow}. */
export const FontProofComponent = Glyphrow;

// Re-export the framework-agnostic core class for convenience, plus its
// deprecated pre-3.0 name.
export { GlyphrowCore };
/** @deprecated The core class was renamed to `Glyphrow` (see `glyphrow`). */
export { GlyphrowCore as FontProof };

export type {
	Align,
	AxisConfig,
	ControlsConfig,
	Range,
	Size,
	GlyphrowOptions,
	GlyphrowState,
	VariableConfig,
} from "../core/types.js";
export type { FeatureTag } from "../core/opentype.js";
