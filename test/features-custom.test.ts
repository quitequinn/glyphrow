// Custom OpenType features: foundry labels, any tag, raw settings, groups,
// samples, the reset button and the count — with plain tags still working.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Glyphrow } from "../src/core/glyphrow.js";
import { canonicalSettings, resolveFeature } from "../src/core/opentype.js";

let host: HTMLDivElement;
beforeEach(() => {
	host = document.createElement("div");
	document.body.appendChild(host);
});
afterEach(() => host.remove());

const type = () => host.querySelector<HTMLElement>(".glyphrow__type")!;
const check = (key: string) =>
	Array.from(host.querySelectorAll<HTMLInputElement>(".glyphrow__feature input")).find((i) => i.value === key)!;
const labels = () => Array.from(host.querySelectorAll(".glyphrow__feature-label")).map((s) => s.textContent);
const flip = (input: HTMLInputElement) => {
	input.checked = !input.checked;
	input.dispatchEvent(new Event("change"));
};

describe("canonicalSettings / resolveFeature", () => {
	it("canonicalises quoted tags and values", () => {
		expect(canonicalSettings("'ss01' 1, 'cv03' 2")).toBe('"ss01" 1, "cv03" 2');
		expect(canonicalSettings('"ss02"')).toBe('"ss02" 1');
		expect(canonicalSettings("'liga' off")).toBe('"liga" 0');
	});

	it("drops a value with anything unsafe in it", () => {
		expect(canonicalSettings("'ss01' 1; color: red")).toBe("");
		expect(canonicalSettings("'ss01' 1, }")).toBe("");
		expect(resolveFeature({ settings: "x" })).toBeNull();
		expect(resolveFeature({ tag: "toolong" })).toBeNull();
	});

	it("keeps plain built-in tags working and rejects unknown plain strings", () => {
		expect(resolveFeature("smcp")?.label).toBe("Small Capitals");
		expect(resolveFeature("cv01" as never)).toBeNull();
	});
});

describe("custom features in the tester", () => {
	it("shows the foundry's label instead of the built-in one", () => {
		new Glyphrow(host, { controls: { features: [{ tag: "ss01", label: "Open digits" }, "onum"] } });
		expect(labels()).toEqual(["Open digits", "Oldstyle Figures"]);
		expect(labels()).not.toContain("Stylistic Set 1");
	});

	it("accepts any tag and raw settings, and composes them", () => {
		const tester = new Glyphrow(host, {
			controls: {
				features: [
					{ tag: "cv03", value: 2, label: "Single-storey a" },
					{ settings: "'ss01' 1, 'ss02' 1", label: "Geometric set" },
				],
			},
		});
		flip(check("cv03=2"));
		flip(check('"ss01" 1, "ss02" 1'));
		expect(type().style.fontFeatureSettings).toBe('"cv03" 2, "ss01" 1, "ss02" 1');
		expect(tester.getState().featureKeys).toEqual(["cv03=2", '"ss01" 1, "ss02" 1']);
		// Custom keys are not built-in tags, so `features` stays FeatureTag-only.
		expect(tester.getState().features).toEqual([]);
	});

	it("offers any number of features", () => {
		const many = Array.from({ length: 40 }, (_, i) => ({
			tag: `cv${String(i + 1).padStart(2, "0")}`,
			label: `Variant ${i + 1}`,
		}));
		new Glyphrow(host, { controls: { features: many } });
		expect(host.querySelectorAll(".glyphrow__feature").length).toBe(40);
	});

	it("keeps an initially active feature that is not offered always on", () => {
		const tester = new Glyphrow(host, {
			features: [{ settings: "'ss05' 1" }],
			controls: { features: [{ tag: "onum", label: "Old-style" }] },
		});
		expect(type().style.fontFeatureSettings).toBe('"ss05" 1');
		flip(check("onum"));
		expect(type().style.fontFeatureSettings).toBe('"ss05" 1, "onum" 1');
		expect(tester.getState().featureKeys).toEqual(['"ss05" 1', "onum"]);
	});

	it("checks an offered feature that is initially active by the same tag", () => {
		new Glyphrow(host, { features: ["ss01"], controls: { features: [{ tag: "ss01", label: "Open digits" }] } });
		expect(check("ss01").checked).toBe(true);
	});

	it("groups the panel with fieldsets when features have groups", () => {
		new Glyphrow(host, {
			controls: {
				features: [
					{ tag: "onum", label: "Old-style", group: "Figures" },
					{ tag: "ss01", label: "Open digits", group: "Sets" },
					{ tag: "tnum", label: "Tabular", group: "Figures" },
					{ tag: "smcp", label: "Small caps" },
				],
			},
		});
		const groups = Array.from(host.querySelectorAll(".glyphrow__feature-group"));
		expect(groups.map((g) => g.querySelector("legend")!.textContent)).toEqual(["Figures", "Sets", "Other"]);
		expect(groups[0]!.querySelectorAll(".glyphrow__feature").length).toBe(2);
	});

	it("renders a sample in the tested family with the feature on", () => {
		new Glyphrow(host, {
			fontFamily: "Test Sans",
			controls: { features: [{ tag: "ss01", label: "Open digits", sample: "0123" }] },
		});
		const sample = host.querySelector<HTMLElement>(".glyphrow__feature-sample")!;
		expect(sample.textContent).toBe("0123");
		expect(sample.getAttribute("aria-hidden")).toBe("true");
		expect(sample.style.getPropertyValue("font-feature-settings")).toBe('"ss01" 1');
		expect(sample.style.getPropertyValue("font-family")).toContain("Test Sans");
	});

	it("counts the features turned on and resets them", () => {
		const onChange = vi.fn();
		new Glyphrow(host, {
			onChange,
			controls: { features: ["liga", { tag: "ss01", label: "Open digits" }, "onum"], featuresReset: "Reset features" },
		});
		const count = host.querySelector(".glyphrow__count")!;
		// liga is on by default in the font, so it is not counted.
		expect(count.textContent).toBe("");
		flip(check("ss01"));
		flip(check("onum"));
		flip(check("liga"));
		expect(count.textContent).toBe("2 on");
		expect(type().style.fontFeatureSettings).toContain('"liga" 0');
		const reset = host.querySelector<HTMLButtonElement>(".glyphrow__reset")!;
		expect(reset.textContent).toBe("Reset features");
		reset.click();
		expect(count.textContent).toBe("");
		expect(check("ss01").checked).toBe(false);
		expect(check("liga").checked).toBe(true);
		expect(type().style.fontFeatureSettings).toBe('"liga" 1');
		expect(onChange.mock.calls.at(-1)![0].featureKeys).toEqual(["liga"]);
	});
});
