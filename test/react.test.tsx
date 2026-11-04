// React wrapper: full markup on the server, hydration that adopts it (no
// warnings, same nodes), the children slot, and in-place text changes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { Glyphrow, GlyphrowCore, type GlyphrowProps } from "../src/react/index.js";
import { renderHTML } from "../src/core/markup.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;
beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
});
afterEach(() => {
	act(() => root?.unmount());
	root = null;
	container.remove();
});

const PROPS: GlyphrowProps = {
	text: "Hamburgefonstiv",
	size: 64,
	lang: "en",
	styles: [
		{ label: "Regular", family: "tt-font-a", value: "a" },
		{ label: "Bold", family: "tt-font-b", value: "b", weight: 700 },
	],
	features: [{ settings: "'ss05' 1" }],
	controls: {
		style: true,
		size: true,
		align: true,
		features: [{ tag: "ss01", label: "Open digits", sample: "0" }, "onum"],
		featuresReset: true,
	},
};

/** Element tags and classes in document order. */
const shape = (el: Element) => Array.from(el.querySelectorAll("*")).map((e) => `${e.tagName}.${e.getAttribute("class") ?? ""}`);

describe("React server rendering", () => {
	it("renders the full markup: sample at its size and the controls bar", () => {
		const html = renderToString(createElement(Glyphrow, PROPS));
		expect(html).toContain("data-glyphrow-rendered");
		expect(html).toContain("Hamburgefonstiv");
		expect(html).toContain("font-size:64px");
		expect(html).toContain("tt-font-a");
		expect(html).toContain('lang="en"');
		expect(html).toContain("glyphrow__controls");
		expect(html).toContain("Open digits");
	});

	it("renders the same structure as the vanilla renderer", () => {
		container.innerHTML = renderToString(createElement(Glyphrow, { ...PROPS, idPrefix: "x" }));
		const vanilla = document.createElement("div");
		vanilla.innerHTML = renderHTML({ ...PROPS, idPrefix: "x" });
		expect(shape(container.firstElementChild!)).toEqual(shape(vanilla.firstElementChild!));
		expect(container.querySelector<HTMLElement>(".glyphrow__type")!.style.cssText).toBe(
			vanilla.querySelector<HTMLElement>(".glyphrow__type")!.style.cssText,
		);
		expect(container.querySelector(".glyphrow__panel")!.id).toBe("x-features");
	});
});

describe("React hydration", () => {
	it("hydrates without warnings and keeps the server's nodes", async () => {
		const html = renderToString(createElement(Glyphrow, PROPS));
		container.innerHTML = html;
		const text = container.querySelector(".glyphrow__text");
		const select = container.querySelector(".glyphrow__select--style");
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const ref: MutableRefObject<GlyphrowCore | null> = { current: null };
		await act(async () => {
			root = hydrateRoot(container, createElement(Glyphrow, { ...PROPS, instanceRef: ref }));
		});
		expect(errors).not.toHaveBeenCalled();
		errors.mockRestore();
		expect(container.querySelector(".glyphrow__text")).toBe(text);
		expect(container.querySelector(".glyphrow__select--style")).toBe(select);
		expect(ref.current).toBeInstanceOf(GlyphrowCore);
		// The core is attached: the style select switches family.
		const sel = select as HTMLSelectElement;
		sel.value = "b";
		sel.dispatchEvent(new Event("change"));
		expect(container.querySelector<HTMLElement>(".glyphrow__type")!.style.fontFamily).toContain("tt-font-b");
		expect(ref.current!.getState().style).toBe("b");
	});

	it("renders children in the bar's slot and re-renders them without rebuilding", async () => {
		/** A host that re-renders its own extra control on every tester change. */
		function Host() {
			const [count, setCount] = useState(0);
			return createElement(
				Glyphrow,
				{ ...PROPS, onChange: () => setCount((c) => c + 1) },
				createElement("p", { className: "glyphrow__control note" }, `changes: ${count}`),
			);
		}
		root = createRoot(container);
		await act(async () => root!.render(createElement(Host)));
		const note = container.querySelector(".glyphrow__controls .glyphrow__extra .note")!;
		expect(note.textContent).toBe("changes: 0");
		const text = container.querySelector(".glyphrow__text");
		const onum = Array.from(container.querySelectorAll<HTMLInputElement>(".glyphrow__feature input")).find(
			(i) => i.value === "onum",
		)!;
		await act(async () => {
			onum.checked = true;
			onum.dispatchEvent(new Event("change"));
		});
		expect(container.querySelector(".note")!.textContent).toBe("changes: 1");
		// The tester was not rebuilt, and its DOM state survived the re-render.
		expect(container.querySelector(".glyphrow__text")).toBe(text);
		expect(onum.checked).toBe(true);
		expect(container.querySelector(".glyphrow__count")!.textContent).toBe("1 on");
	});

	it("applies text and lang prop changes in place", async () => {
		const ref: MutableRefObject<GlyphrowCore | null> = { current: null };
		let setSample: (s: { text: string; lang: string }) => void = () => {};
		function Host() {
			const [sample, set] = useState({ text: "Hello", lang: "en" });
			setSample = set;
			const keep = useRef(ref);
			return createElement(Glyphrow, { ...PROPS, ...sample, instanceRef: keep.current });
		}
		root = createRoot(container);
		await act(async () => root!.render(createElement(Host)));
		const text = container.querySelector<HTMLElement>(".glyphrow__text")!;
		const instance = ref.current;
		await act(async () => setSample({ text: "Grüße", lang: "de" }));
		expect(container.querySelector(".glyphrow__text")).toBe(text);
		expect(text.textContent).toBe("Grüße");
		expect(text.getAttribute("lang")).toBe("de");
		expect(ref.current).toBe(instance);
	});

	it("rebuilds when a structural option changes and tears down on unmount", async () => {
		root = createRoot(container);
		await act(async () => root!.render(createElement(Glyphrow, { text: "A", controls: { size: true } })));
		expect(container.querySelector(".glyphrow__slider--tracking")).toBeNull();
		await act(async () => root!.render(createElement(Glyphrow, { text: "A", controls: { size: true, tracking: true } })));
		expect(container.querySelector(".glyphrow__slider--tracking")).not.toBeNull();
		await act(async () => root!.unmount());
		root = null;
		expect(container.children.length).toBe(0);
	});
});
