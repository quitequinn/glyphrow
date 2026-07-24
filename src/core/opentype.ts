// OpenType feature registry: correct, spec-accurate tags, labels and grouping.
// Replaces the legacy optValues table which had duplicate/ambiguous labels
// ("Contextual" for both calt and clig, "Historical" for both hlig and hist)
// and a mislabelled `nalt`.

/** A four-character OpenType GSUB/GPOS feature tag. */
export type FeatureTag = string;

/** Logical grouping used to organise features in a control UI. */
export type FeatureGroup =
	| "Ligatures"
	| "Letter Case"
	| "Figures"
	| "Fractions"
	| "Alternates"
	| "Position"
	| "Stylistic Sets";

/** Definition of a single OpenType feature exposed by the tester. */
export interface FeatureDef {
	/** The OpenType feature tag, e.g. "smcp". */
	tag: FeatureTag;
	/** Human-readable, unambiguous label. */
	label: string;
	/** Group the feature belongs to. */
	group: FeatureGroup;
}

/**
 * The default, ordered list of supported OpenType features. Labels are unique
 * and follow the Microsoft OpenType feature registry naming.
 */
export const FEATURES: readonly FeatureDef[] = [
	// Ligatures
	{ tag: "liga", label: "Standard Ligatures", group: "Ligatures" },
	{ tag: "dlig", label: "Discretionary Ligatures", group: "Ligatures" },
	{ tag: "hlig", label: "Historical Ligatures", group: "Ligatures" },
	{ tag: "clig", label: "Contextual Ligatures", group: "Ligatures" },

	// Letter Case
	{ tag: "smcp", label: "Small Capitals", group: "Letter Case" },
	{ tag: "c2sc", label: "Capitals to Small Capitals", group: "Letter Case" },
	{ tag: "case", label: "Case-Sensitive Forms", group: "Letter Case" },
	{ tag: "cpsp", label: "Capital Spacing", group: "Letter Case" },

	// Figures
	{ tag: "lnum", label: "Lining Figures", group: "Figures" },
	{ tag: "onum", label: "Oldstyle Figures", group: "Figures" },
	{ tag: "pnum", label: "Proportional Figures", group: "Figures" },
	{ tag: "tnum", label: "Tabular Figures", group: "Figures" },
	{ tag: "zero", label: "Slashed Zero", group: "Figures" },
	{ tag: "ordn", label: "Ordinals", group: "Figures" },

	// Fractions
	{ tag: "frac", label: "Fractions", group: "Fractions" },
	{ tag: "afrc", label: "Alternative Fractions", group: "Fractions" },

	// Alternates
	{ tag: "swsh", label: "Swash", group: "Alternates" },
	{ tag: "calt", label: "Contextual Alternates", group: "Alternates" },
	{ tag: "salt", label: "Stylistic Alternates", group: "Alternates" },
	{ tag: "hist", label: "Historical Forms", group: "Alternates" },
	{ tag: "nalt", label: "Alternate Annotation Forms", group: "Alternates" },

	// Position
	{ tag: "sups", label: "Superscript", group: "Position" },
	{ tag: "subs", label: "Subscript", group: "Position" },

	// Stylistic Sets ss01–ss20
	...Array.from({ length: 20 }, (_, i): FeatureDef => {
		const n = i + 1;
		const tag = `ss${String(n).padStart(2, "0")}`;
		return { tag, label: `Stylistic Set ${n}`, group: "Stylistic Sets" };
	}),
];

/** Lookup map from tag to its definition. */
export const FEATURE_BY_TAG: ReadonlyMap<FeatureTag, FeatureDef> = new Map(
	FEATURES.map((f) => [f.tag, f]),
);

/** Returns the label for a tag, falling back to the upper-cased tag itself. */
export function featureLabel(tag: FeatureTag): string {
	return FEATURE_BY_TAG.get(tag)?.label ?? tag.toUpperCase();
}

/** True if the tag is a known, supported OpenType feature. */
export function isKnownFeature(tag: string): boolean {
	return FEATURE_BY_TAG.has(tag);
}

/**
 * Features that are on by default in most fonts. Removing them from
 * `font-feature-settings` reverts them to on, so to actually *disable* one it
 * must be written explicitly as `"tag" 0`.
 */
export const DEFAULT_ON: readonly FeatureTag[] = ["liga", "clig", "calt"];

/**
 * Builds a CSS `font-feature-settings` value from a set of active tags so that
 * multiple features compose (e.g. small caps + oldstyle figures) instead of
 * each selection overwriting the others.
 *
 * When `offered` is given (the tags exposed by a features control), any
 * default-on feature that is offered but not active is written as `"tag" 0` so
 * it can genuinely be turned off. Returns "normal" when nothing is emitted.
 */
export function featureSettings(active: Iterable<FeatureTag>, offered?: Iterable<FeatureTag>): string {
	const activeSet = new Set(Array.from(active).filter(isKnownFeature));
	const parts: string[] = [];
	for (const tag of activeSet) parts.push(`"${tag}" 1`);
	if (offered) {
		for (const tag of offered) {
			if (DEFAULT_ON.includes(tag) && !activeSet.has(tag)) parts.push(`"${tag}" 0`);
		}
	}
	return parts.length ? parts.join(", ") : "normal";
}
