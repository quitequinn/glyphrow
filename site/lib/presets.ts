// Setting presets cycled across the infinite scroll so consecutive rows show
// different Glyphrow configurations — sizes, controls, OpenType features,
// alignment and sample text. Each row picks presets[index % presets.length].

import type { GlyphrowProps, FeatureTag } from "glyphrow/react";

/** A named bundle of Glyphrow options plus the sample text to seed. */
export interface Preset {
	/** Short label describing what this preset demonstrates. */
	label: string;
	/** Seed sample text. */
	sample: string;
	/** Glyphrow options (font-family is supplied per row). */
	opts: Partial<GlyphrowProps>;
}

const f = (...tags: string[]) => tags as FeatureTag[];

export const PRESETS: Preset[] = [
	{
		label: "Display · ligatures",
		sample: "Handgloves",
		opts: { size: 96, controls: { size: true, tracking: true, features: true }, features: f("liga", "dlig"), showValues: true },
	},
	{
		label: "Reading · full controls",
		sample: "Sphinx of black quartz, judge my vow — the five boxing wizards jump quickly.",
		opts: { size: 26, wrap: true, controls: { size: true, weight: true, tracking: true, align: true } },
	},
	{
		label: "Auto-fit headline",
		sample: "Typographic voice",
		opts: { size: "fit", controls: { tracking: true, features: true, align: true } },
	},
	{
		label: "Weight & italic",
		sample: "Bold, light, and italic",
		opts: { size: 52, weight: 600, controls: { weight: true, italic: true, features: true }, showValues: true },
	},
	{
		label: "Numerals · tabular",
		sample: "0123456789 — $1,234.56 — 3/4",
		opts: { size: 44, controls: { features: true, tracking: true }, features: f("tnum") },
	},
	{
		label: "Centered quote",
		sample: "The quick brown fox jumps over the lazy dog",
		opts: { size: 32, align: "center", controls: { size: true, align: true, features: true } },
	},
];
