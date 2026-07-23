// Public surface of the framework-agnostic core.

export { Glyphrow } from "./glyphrow.js";
/** @deprecated Renamed to {@link Glyphrow}. */
export { Glyphrow as FontProof } from "./glyphrow.js";
export {
	FEATURES,
	FEATURE_BY_TAG,
	featureLabel,
	featureSettings,
	isKnownFeature,
} from "./opentype.js";
export type { FeatureDef, FeatureGroup, FeatureTag } from "./opentype.js";
export type {
	Align,
	AxisConfig,
	ControlsConfig,
	Range,
	Size,
	GlyphrowOptions,
	GlyphrowState,
	VariableConfig,
	// Deprecated aliases (renamed in 3.0.0).
	FontProofOptions,
	FontProofState,
} from "./types.js";
