// OpenType feature registry: correct, spec-accurate tags, labels and grouping.
// Replaces the legacy optValues table which had duplicate/ambiguous labels
// ("Contextual" for both calt and clig, "Historical" for both hlig and hist)
// and a mislabelled `nalt`.

/** A four-character OpenType GSUB/GPOS feature tag known to the tester. */
export type FeatureTag =
	| "liga" | "dlig" | "hlig" | "clig"
	| "smcp" | "c2sc" | "case" | "cpsp"
	| "lnum" | "onum" | "pnum" | "tnum" | "zero" | "ordn"
	| "frac" | "afrc"
	| "swsh" | "calt" | "salt" | "hist" | "nalt"
	| "sups" | "subs"
	| "ss01" | "ss02" | "ss03" | "ss04" | "ss05" | "ss06" | "ss07"
	| "ss08" | "ss09" | "ss10" | "ss11" | "ss12" | "ss13" | "ss14"
	| "ss15" | "ss16" | "ss17" | "ss18" | "ss19" | "ss20";

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
		// The padded tag is a runtime-built string; it's one of the ss01–ss20
		// members of FeatureTag by construction.
		const tag = `ss${String(n).padStart(2, "0")}` as FeatureTag;
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
export function isKnownFeature(tag: string): tag is FeatureTag {
	// Membership test against arbitrary input; the cast just satisfies the typed
	// Map key and is sound because a miss returns false.
	return FEATURE_BY_TAG.has(tag as FeatureTag);
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

// ---- Custom features (foundry labels, any tag, raw settings) ---------------

/**
 * A feature described by the host instead of the built-in table: a foundry's
 * own name for it ("Open digits" rather than "Stylistic Set 1"), any
 * four-character tag (`cv01`, `titl`, …) or a raw `font-feature-settings`
 * value, an optional group heading and an optional sample shown beside it.
 * Give either `tag` (optionally with `value`) or `settings`.
 */
export interface FeatureOption {
	/** Any four-character OpenType tag, e.g. "ss01" or "cv03". */
	tag?: string;
	/** Value written for `tag` when on (default 1), e.g. 3 for the third `cv03` alternate. */
	value?: number;
	/**
	 * A raw `font-feature-settings` value applied when on, e.g. `'ss01' 1` or
	 * `"ss01", "ss02"`. Only quoted four-character tags with an optional
	 * integer or on/off value are kept; anything else is dropped.
	 */
	settings?: string;
	/** Label shown next to the checkbox. Defaults to the built-in label, then the tag. */
	label?: string;
	/** Group heading in the features panel. Giving any feature a group groups the panel. */
	group?: string;
	/** Short sample shown beside the label, set in the tested font with the feature on. */
	sample?: string;
}

/** A feature as accepted by `features` / `controls.features`: a built-in tag or a {@link FeatureOption}. */
export type FeatureInput = FeatureTag | FeatureOption;

/** A feature after validation: what the tester renders and composes. */
export interface ResolvedFeature {
	/** Stable identity: the tag, or the canonical settings string. Used as the checkbox value. */
	key: string;
	/** Label shown in the panel. */
	label: string;
	/** Group heading, if the host gave one. */
	group?: string;
	/** Sample shown beside the label, if any. */
	sample?: string;
	/** Settings fragment written while the feature is on. */
	on: string;
	/** Settings fragment written while it is offered but off (default-on tags only), else undefined. */
	off?: string;
	/** True for a default-on tag (liga/clig/calt): offered, it starts checked. */
	defaultOn: boolean;
}

/** A valid OpenType tag: exactly four printable letters, digits or spaces. */
const TAG_RE = /^[A-Za-z0-9 ]{4}$/;
/** One `"tag" value` pair in a settings string (value optional). */
const SETTING_RE = /^\s*(["'])([A-Za-z0-9 ]{4})\1(?:\s+(\d{1,3}|on|off))?\s*$/;

/**
 * Parses a `font-feature-settings` value into a canonical, injection-safe
 * string (`"ss01" 1, "ss02" 1`). Returns "" when any part is invalid, so a
 * malformed value is dropped whole rather than half-applied.
 * @param settings Raw settings, e.g. `'ss01' 1, 'cv03' 2`.
 */
export function canonicalSettings(settings: string): string {
	const parts: string[] = [];
	for (const part of settings.split(",")) {
		if (!part.trim()) continue;
		const match = SETTING_RE.exec(part);
		if (!match) return "";
		const raw = match[3] ?? "1";
		const value = raw === "on" ? "1" : raw === "off" ? "0" : String(Number(raw));
		parts.push(`"${match[2]}" ${value}`);
	}
	return parts.join(", ");
}

/**
 * Validates one feature input and resolves its label, settings and identity.
 * Plain strings must be built-in tags (as before); objects may use any tag or
 * raw settings. Returns null for anything invalid.
 * @param input A built-in tag or a {@link FeatureOption}.
 */
export function resolveFeature(input: FeatureInput): ResolvedFeature | null {
	if (typeof input === "string") {
		if (!isKnownFeature(input)) return null;
		const def = FEATURE_BY_TAG.get(input)!;
		const defaultOn = DEFAULT_ON.includes(input);
		return {
			key: input,
			label: def.label,
			on: `"${input}" 1`,
			off: defaultOn ? `"${input}" 0` : undefined,
			defaultOn,
		};
	}
	if (!input || typeof input !== "object") return null;
	const extra = {
		...(input.group ? { group: String(input.group) } : {}),
		...(input.sample ? { sample: String(input.sample) } : {}),
	};
	if (typeof input.tag === "string" && TAG_RE.test(input.tag)) {
		const tag = input.tag;
		const known = FEATURE_BY_TAG.get(tag as FeatureTag);
		const value = Number.isInteger(input.value) && input.value! >= 0 ? input.value! : 1;
		const defaultOn = value === 1 && DEFAULT_ON.includes(tag as FeatureTag);
		return {
			key: value === 1 ? tag : `${tag}=${value}`,
			label: input.label ?? known?.label ?? tag,
			on: `"${tag}" ${value}`,
			off: defaultOn ? `"${tag}" 0` : undefined,
			defaultOn,
			...extra,
		};
	}
	if (typeof input.settings === "string") {
		const on = canonicalSettings(input.settings);
		if (!on) return null;
		const firstTag = /"(.{4})"/.exec(on)![1] as FeatureTag;
		return {
			key: on,
			label: input.label ?? FEATURE_BY_TAG.get(firstTag)?.label ?? firstTag,
			on,
			defaultOn: false,
			...extra,
		};
	}
	return null;
}

/**
 * Composes `font-feature-settings` from resolved features: every active one's
 * "on" fragment, then the "off" fragment of each offered default-on feature
 * that is not active. Returns "normal" when nothing is emitted.
 * @param active Active features, in the order they were turned on.
 * @param offered Features offered by the control (for explicit "off" values).
 */
export function composeFeatureSettings(
	active: Iterable<ResolvedFeature>,
	offered: readonly ResolvedFeature[] = [],
): string {
	const parts: string[] = [];
	const activeKeys = new Set<string>();
	for (const f of active) {
		activeKeys.add(f.key);
		parts.push(f.on);
	}
	for (const f of offered) {
		if (f.off && !activeKeys.has(f.key)) parts.push(f.off);
	}
	return parts.length ? parts.join(", ") : "normal";
}
