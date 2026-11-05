// Regression tests for the PR #62 review: palette injection, default-on raw
// settings, failed construction, unique SSR ids, kept axis values, style
// indexing, sample styling, axis steps, refit on font load, stale adopted
// controls, built-in tags in state and duplicate style values.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Glyphrow } from "../src/core/glyphrow.js";
import { Fitter } from "../src/core/fit.js";
import { renderHTML } from "../src/core/markup.js";
import { resolveFeature, composeFeatureSettings } from "../src/core/opentype.js";
import { snapToStep } from "../src/core/view.js";
import type { StyleOption } from "../src/core/types.js";

let host: HTMLDivElement;
beforeEach(() => {
	host = document.createElement("div");
	document.body.appendChild(host);
});
afterEach(() => {
	host.remove();
	vi.restoreAllMocks();
});

const type = () => host.querySelector<HTMLElement>(".glyphrow__type")!;
const axis = (tag: string) => host.querySelector<HTMLInputElement>(`.glyphrow__slider[data-axis="${tag}"]`)!;
const move = (input: HTMLInputElement, value: number) => {
	input.value = String(value);
	input.dispatchEvent(new Event("input"));
};

/** Mounts server markup into the host and returns its tester root. */
function serve(html: string): HTMLElement {
	host.innerHTML = html;
	return host.firstElementChild as HTMLElement;
}

describe("review fixes", () => {
	it("drops a palette that carries CSS, on the server and on the client", () => {
		const evil = "dark; background-image: url(https://example.test/x)";
		const html = renderHTML({ palette: evil });
		expect(html).not.toContain("example.test");
		expect(html).toContain("font-palette: normal");
		const tester = new Glyphrow(host, { palette: evil, controls: { palette: ["dark", evil, "--brand"] } });
		expect(tester.getState().palette).toBe("normal");
		const options = Array.from(host.querySelectorAll<HTMLOptionElement>(".glyphrow__select--palette option"), (o) => o.value);
		expect(options).toEqual(["dark", "--brand"]);
	});

	it("turns a default-on feature given as raw settings off explicitly", () => {
		const liga = resolveFeature({ settings: "'liga' 1", label: "Ligatures" })!;
		expect(liga.defaultOn).toBe(true);
		expect(composeFeatureSettings([], [liga])).toBe('"liga" 0');
		// Mixed settings keep the font's defaults while unchecked.
		const mixed = resolveFeature({ settings: "'liga' 1, 'ss01' 1" })!;
		expect(mixed.defaultOn).toBe(false);
		expect(composeFeatureSettings([], [mixed])).toBe("normal");

		new Glyphrow(host, { controls: { features: [{ settings: "'liga' 1", label: "Ligatures" }] } });
		const check = host.querySelector<HTMLInputElement>(".glyphrow__feature input")!;
		expect(check.checked).toBe(true);
		check.checked = false;
		check.dispatchEvent(new Event("change"));
		expect(type().style.fontFeatureSettings).toContain('"liga" 0');
	});

	it("cleans up when an extraControls callback throws", () => {
		expect(
			() =>
				new Glyphrow(host, {
					controls: { size: true },
					extraControls: () => {
						throw new Error("boom");
					},
				}),
		).toThrow("boom");
		expect(host.childElementCount).toBe(0);
		expect(host.hasAttribute("data-glyphrow-rendered")).toBe(false);
	});

	it("gives each renderHTML call its own id prefix", () => {
		const options = { controls: { features: ["onum" as const] } };
		const ids = [renderHTML(options), renderHTML(options)].map((h) => /id="([^"]+)"/.exec(h)![1]);
		expect(ids[0]).not.toBe(ids[1]);
		expect(renderHTML({ ...options, idPrefix: "t" })).toContain('id="t-features"');
	});

	it("keeps a moved axis value through a style without that axis", () => {
		const styles: StyleOption[] = [
			{ label: "A", family: "a", value: "a", axes: { wdth: { min: 75, max: 125, default: 100 } } },
			{ label: "B", family: "b", value: "b" },
			{ label: "C", family: "c", value: "c", axes: { wdth: { min: 75, max: 125, default: 90 } } },
		];
		const tester = new Glyphrow(host, { styles, controls: { style: true, axes: true } });
		move(axis("wdth"), 80);
		tester.setStyle("b");
		expect(tester.getState().axes.wdth).toBeUndefined();
		tester.setStyle("c");
		expect(tester.getState().axes.wdth).toBe(80);
		expect(axis("wdth").value).toBe("80");
	});

	it("selects styles by their position in the option even after invalid ones", () => {
		const styles: StyleOption[] = [
			{ label: "Broken", family: "" },
			{ label: "One", family: "one" },
			{ label: "Two", family: "two" },
		];
		const tester = new Glyphrow(host, { styles, style: 2, controls: { style: true } });
		expect(tester.getState().style).toBe("2");
		expect(type().style.fontFamily).toContain("two");
		tester.setStyle(1);
		expect(tester.getState().style).toBe("1");
		expect(type().style.fontFamily).toContain("one");
	});

	it("styles feature samples with the shown face", () => {
		const styles: StyleOption[] = [
			{ label: "Regular", family: "r", value: "r" },
			{ label: "Bold", family: "b", value: "b", weight: 700, italic: true },
			{ label: "Var", family: "v", value: "v", axes: { wdth: { min: 75, max: 125, default: 110 } } },
		];
		const tester = new Glyphrow(host, {
			styles,
			controls: { style: true, features: [{ tag: "ss01", sample: "a" }] },
		});
		const sample = host.querySelector<HTMLElement>(".glyphrow__feature-sample")!;
		tester.setStyle("b");
		expect(sample.style.fontFamily).toContain('"b"');
		expect(sample.style.fontWeight).toBe("700");
		expect(sample.style.fontStyle).toBe("italic");
		expect(sample.style.fontFeatureSettings).toBe('"ss01" 1');
		tester.setStyle("v");
		expect(sample.style.fontVariationSettings).toBe('"wdth" 110');
		expect(renderHTML({ styles, style: "v", controls: { features: [{ tag: "ss01", sample: "a" }] } })).toContain(
			'font-variation-settings: &quot;wdth&quot; 110',
		);
	});

	it("snaps axis values to the slider's step", () => {
		expect(snapToStep(103, { min: 100, max: 900, step: 50 })).toBe(100);
		expect(snapToStep(130, { min: 100, max: 900, step: 50 })).toBe(150);
		expect(snapToStep(899, { min: 0, max: 899, step: 100 })).toBe(800);
		expect(snapToStep(0.33, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
		const tester = new Glyphrow(host, {
			variable: { opsz: { min: 8, max: 144, step: 4, default: 13 } },
			controls: { axes: true },
		});
		expect(tester.getState().axes.opsz).toBe(12);
		expect(axis("opsz").value).toBe("12");
	});

	it("re-fits once a style's face has loaded", async () => {
		let loaded!: () => void;
		const load = vi.fn(() => new Promise<void>((resolve) => (loaded = resolve)));
		Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
		const schedule = vi.spyOn(Fitter.prototype, "schedule");
		try {
			const tester = new Glyphrow(host, {
				size: "fit",
				styles: [
					{ label: "A", family: "a", value: "a" },
					{ label: "B", family: "b", value: "b" },
				],
			});
			tester.setStyle("b");
			const before = schedule.mock.calls.length;
			loaded();
			await Promise.resolve();
			await Promise.resolve();
			expect(schedule.mock.calls.length).toBeGreaterThan(before);
			tester.destroy();
		} finally {
			delete (document as { fonts?: unknown }).fonts;
		}
	});

	it("resets adopted controls to the new instance's state", () => {
		const options = {
			size: 64,
			wrap: true,
			controls: { size: true, wrap: true, features: ["onum" as const] },
		};
		serve(renderHTML(options));
		const root = host.firstElementChild as HTMLElement;
		const first = new Glyphrow(root, options);
		const size = root.querySelector<HTMLInputElement>(".glyphrow__slider--size")!;
		move(size, 120);
		root.querySelector<HTMLButtonElement>(".glyphrow__toggle--wrap")!.click();
		const onum = root.querySelector<HTMLInputElement>(".glyphrow__feature input")!;
		onum.checked = true;
		onum.dispatchEvent(new Event("change"));
		first.destroy();

		const second = new Glyphrow(root, options);
		expect(second.getState().size).toBe(64);
		expect(size.value).toBe("64");
		expect(root.querySelector(".glyphrow__control--size .glyphrow__value")!.textContent).toBe("64px");
		expect(root.querySelector(".glyphrow__toggle--wrap")!.getAttribute("aria-pressed")).toBe("true");
		expect(onum.checked).toBe(false);
		expect(root.querySelector(".glyphrow__count")?.textContent ?? "").toBe("");
	});

	it("lists a built-in tag at a non-default value in state.features", () => {
		const tester = new Glyphrow(host, {
			features: [{ tag: "ss01", value: 2 }, { settings: "'ss02' 1" }],
		});
		expect(tester.getState().featureKeys).toEqual(["ss01=2", '"ss02" 1']);
		expect(tester.getState().features).toEqual(["ss01"]);
	});

	it("makes duplicate style values unique so each style can be chosen", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const tester = new Glyphrow(host, {
			styles: [
				{ label: "One", family: "one", value: "x" },
				{ label: "Two", family: "two", value: "x" },
			],
			controls: { style: true },
		});
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("Glyphrow: duplicate style value"));
		const values = Array.from(host.querySelectorAll<HTMLOptionElement>(".glyphrow__select--style option"), (o) => o.value);
		expect(values).toEqual(["x", "x-1"]);
		tester.setStyle("x-1");
		expect(type().style.fontFamily).toContain("two");
		tester.setStyle(0);
		expect(tester.getState().style).toBe("x");
		tester.setStyle(1);
		expect(tester.getState().style).toBe("x-1");
	});
});
