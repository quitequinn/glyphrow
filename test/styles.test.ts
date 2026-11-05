// Per-style families: a style select switches family, weight, italic and axes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Glyphrow } from "../src/core/glyphrow.js";
import type { StyleOption } from "../src/core/types.js";

let host: HTMLDivElement;
beforeEach(() => {
	host = document.createElement("div");
	document.body.appendChild(host);
});
afterEach(() => host.remove());

const type = () => host.querySelector<HTMLElement>(".glyphrow__type")!;
const styleSelect = () => host.querySelector<HTMLSelectElement>(".glyphrow__select--style")!;
const choose = (value: string) => {
	styleSelect().value = value;
	styleSelect().dispatchEvent(new Event("change"));
};

const STYLES: StyleOption[] = [
	{ label: "Regular", family: "tt-font-aaa", value: "aaa" },
	{ label: "Bold", family: "tt-font-bbb", value: "bbb", weight: 700 },
	{ label: "Italic", family: "tt-font-ccc", value: "ccc", italic: true },
	{
		label: "Variable",
		family: "tt-font-vvv",
		value: "vvv",
		axes: { wght: { min: 100, max: 900, default: 300, label: "Weight" }, wdth: { min: 75, max: 125, default: 100 } },
	},
];

describe("styles", () => {
	it("renders a style select and sets the first style's family", () => {
		const tester = new Glyphrow(host, { styles: STYLES, controls: { style: true } });
		const options = Array.from(styleSelect().options).map((o) => [o.value, o.textContent]);
		expect(options).toEqual([
			["aaa", "Regular"],
			["bbb", "Bold"],
			["ccc", "Italic"],
			["vvv", "Variable"],
		]);
		expect(type().style.fontFamily).toContain("tt-font-aaa");
		// A single-face family renders at normal weight and style (never synthesised).
		expect(type().style.fontWeight).toBe("400");
		expect(type().style.fontStyle).toBe("normal");
		expect(tester.getState().style).toBe("aaa");
	});

	it("switches family, weight and italic with the select", () => {
		const onChange = vi.fn();
		const tester = new Glyphrow(host, { styles: STYLES, controls: { style: true }, onChange });
		choose("bbb");
		expect(type().style.fontFamily).toContain("tt-font-bbb");
		expect(type().style.fontWeight).toBe("700");
		choose("ccc");
		expect(type().style.fontStyle).toBe("italic");
		expect(tester.getState().style).toBe("ccc");
		expect(onChange.mock.calls.at(-1)![0].style).toBe("ccc");
		expect(host.querySelector(".glyphrow__control--style .glyphrow__value")!.textContent).toBe("Italic");
	});

	it("starts at the style given by value or index", () => {
		new Glyphrow(host, { styles: STYLES, style: "bbb", controls: { style: true } });
		expect(styleSelect().value).toBe("bbb");
		host.replaceChildren();
		new Glyphrow(host, { styles: STYLES, style: 2, hydrate: false });
		expect(type().style.fontFamily).toContain("tt-font-ccc");
	});

	it("hides the weight and italic controls when styles are given", () => {
		new Glyphrow(host, { styles: STYLES, controls: { style: true, weight: true, italic: true } });
		expect(host.querySelector(".glyphrow__slider--weight")).toBeNull();
		expect(host.querySelector(".glyphrow__toggle--italic")).toBeNull();
	});

	it("omits the style select with fewer than two styles", () => {
		new Glyphrow(host, { styles: [STYLES[0]!], controls: { style: true } });
		expect(host.querySelector(".glyphrow__select--style")).toBeNull();
		expect(type().style.fontFamily).toContain("tt-font-aaa");
	});

	it("shows a style's own axes, hiding them for styles without", async () => {
		const tester = new Glyphrow(host, { styles: STYLES, controls: { style: true, axes: true } });
		const wght = host.querySelector<HTMLInputElement>(".glyphrow__slider--axis-wght")!;
		const control = wght.closest<HTMLElement>(".glyphrow__control")!;
		expect(control.hidden).toBe(true);
		choose("vvv");
		expect(control.hidden).toBe(false);
		expect(wght.value).toBe("300");
		expect(tester.getState().axes).toEqual({ wght: 300, wdth: 100 });
		expect(type().style.getPropertyValue("font-variation-settings")).toBe('"wght" 300, "wdth" 100');
		expect(host.querySelector(".glyphrow__control--axis-wght .glyphrow__label")!.textContent).toBe("Weight");

		wght.value = "650";
		wght.dispatchEvent(new Event("input"));
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		expect(type().style.getPropertyValue("font-variation-settings")).toBe('"wght" 650, "wdth" 100');

		choose("aaa");
		expect(control.hidden).toBe(true);
		expect(type().style.getPropertyValue("font-variation-settings")).toBe("normal");
	});

	it("keeps an axis the visitor moved when switching between styles that share it", () => {
		const a = { min: 100, max: 900, default: 300 };
		const tester = new Glyphrow(host, {
			styles: [
				{ label: "Light", family: "tt-v", axes: { wght: a } },
				{ label: "Bold", family: "tt-v", axes: { wght: { ...a, default: 700 } } },
			],
			controls: { style: true, axes: true },
		});
		choose("1");
		expect(tester.getState().axes.wght).toBe(700); // untouched: the style's own coordinate
		const wght = host.querySelector<HTMLInputElement>(".glyphrow__slider--axis-wght")!;
		wght.value = "500";
		wght.dispatchEvent(new Event("input"));
		choose("0");
		expect(tester.getState().axes.wght).toBe(500); // moved: kept
	});

	it("setStyle switches programmatically and updates feature samples", () => {
		const tester = new Glyphrow(host, {
			styles: STYLES,
			controls: { style: true, features: [{ tag: "ss01", label: "Open", sample: "0" }] },
		});
		tester.setStyle("bbb");
		expect(styleSelect().value).toBe("bbb");
		expect(host.querySelector<HTMLElement>(".glyphrow__feature-sample")!.style.fontFamily).toContain("tt-font-bbb");
	});

	it("drops styles without a family and strips quotes and delimiters from families", () => {
		new Glyphrow(host, {
			styles: [{ label: "Bad", family: "" }, { label: "Ok", family: 'Evil"; color: red' }],
		});
		expect(type().style.fontFamily).toContain("Evil color: red");
		expect(type().style.color).toBe("");
	});
});
