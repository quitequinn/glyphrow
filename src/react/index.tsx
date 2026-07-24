// React wrapper around the framework-agnostic Glyphrow core. React is a peer
// dependency, externalised at build time, so the core stays dependency-free.

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
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
export function Glyphrow(props: GlyphrowProps): ReactElement {
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

// Deprecated pre-3.0 names for the React component. The old `fontproof/react`
// entry exported this component as `FontProof`; both aliases point at the
// component so a `<FontProof/>` migration keeps rendering.
/** @deprecated Renamed to {@link Glyphrow}. */
export const FontProofComponent = Glyphrow;
/** @deprecated Renamed to {@link Glyphrow}. */
export const FontProof = Glyphrow;

// The framework-agnostic core class, for consumers who want it from this entry.
export { GlyphrowCore };

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

// Deprecated type aliases (renamed in 3.0.0), also surfaced from the React entry.
/** @deprecated Renamed to {@link GlyphrowProps}. */
export type FontProofProps = GlyphrowProps;
export type {
	/** @deprecated Renamed to `GlyphrowOptions`. */
	GlyphrowOptions as FontProofOptions,
	/** @deprecated Renamed to `GlyphrowState`. */
	GlyphrowState as FontProofState,
} from "../core/types.js";
