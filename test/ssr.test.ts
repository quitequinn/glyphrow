// Server-rendered markup (renderHTML) and the core adopting it instead of
// rebuilding; plus setText/lang, plain paste and the extra-controls slot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Glyphrow } from "../src/core/glyphrow.js";
import { renderHTML } from "../src/core/markup.js";
import type { GlyphrowOptions } from "../src/core/types.js";

let container: HTMLDivElement;
beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
});
afterEach(() => container.remove());

const OPTIONS: GlyphrowOptions = {
	text: "Hamburgefonstiv <b>",
	fontFamily: "Test Sans",
	size: 72,
	lang: "de",
	features: ["onum"],
	controls: { size: true, tracking: true, align: true, features: [{ tag: "ss01", label: "Open digits" }, "onum"] },
};

describe("renderHTML", () => {
	it("renders the sample at its size and the controls bar, escaped", () => {
		const html = renderHTML(OPTIONS);
		expect(html).toContain('class="glyphrow"');
		expect(html).toContain("data-glyphrow-rendered");
		expect(html).toContain("Hamburgefonstiv &lt;b&gt;");
		expect(html).toContain("font-size: 72px");
		expect(html).toContain('lang="de"');
		expect(html).toContain("glyphrow__controls");
		expect(html).toContain("Open digits");
		expect(html).not.toContain("<b>");
	});

	it("matches the markup the vanilla core builds", () => {
		container.innerHTML = renderHTML({ ...OPTIONS, idPrefix: "t" });
		const fresh = document.createElement("div");
		new Glyphrow(fresh, { ...OPTIONS, idPrefix: "t" });
		const server = container.firstElementChild as HTMLElement;
		// Same element structure and classes, in the same order.
		const shape = (root: Element) =>
			Array.from(root.querySelectorAll("*")).map((e) => `${e.tagName}.${e.className}`);
		expect(shape(fresh)).toEqual(shape(server));
		expect(fresh.querySelector<HTMLElement>(".glyphrow__type")!.style.cssText).toBe(
			server.querySelector<HTMLElement>(".glyphrow__type")!.style.cssText,
		);
	});
});

describe("adopting server markup", () => {
	it("attaches to existing elements instead of rebuilding them", async () => {
		container.innerHTML = renderHTML(OPTIONS);
		const root = container.firstElementChild as HTMLElement;
		const text = root.querySelector(".glyphrow__text")!;
		const slider = root.querySelector<HTMLInputElement>(".glyphrow__slider--size")!;
		const onChange = vi.fn();
		const tester = new Glyphrow(root, { ...OPTIONS, onChange });
		// Same nodes: nothing was rebuilt.
		expect(root.querySelector(".glyphrow__text")).toBe(text);
		expect(root.querySelector(".glyphrow__slider--size")).toBe(slider);
		// And they are live.
		slider.value = "120";
		slider.dispatchEvent(new Event("input"));
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		expect(root.querySelector<HTMLElement>(".glyphrow__type")!.style.fontSize).toBe("120px");
		expect(onChange.mock.calls.at(-1)![0].size).toBe(120);
		const ss01 = root.querySelector<HTMLInputElement>('.glyphrow__feature input[value="ss01"]')!;
		ss01.checked = true;
		ss01.dispatchEvent(new Event("change"));
		expect(tester.getState().featureKeys).toEqual(["onum", "ss01"]);
	});

	it("leaves adopted markup in place on destroy", () => {
		container.innerHTML = renderHTML(OPTIONS);
		const root = container.firstElementChild as HTMLElement;
		new Glyphrow(root, OPTIONS).destroy();
		expect(root.querySelector(".glyphrow__text")).not.toBeNull();
	});

	it("rebuilds when hydrate is false or the markup is incomplete", () => {
		container.innerHTML = renderHTML(OPTIONS);
		const root = container.firstElementChild as HTMLElement;
		const text = root.querySelector(".glyphrow__text");
		new Glyphrow(root, { ...OPTIONS, hydrate: false });
		expect(root.querySelector(".glyphrow__text")).not.toBe(text);

		const bare = document.createElement("div");
		bare.setAttribute("data-glyphrow-rendered", "");
		new Glyphrow(bare, OPTIONS);
		expect(bare.querySelector(".glyphrow__text")!.textContent).toBe(OPTIONS.text);
	});
});

describe("text, language and paste", () => {
	it("setText replaces the sample and sets or clears lang", () => {
		const host = document.createElement("div");
		const onChange = vi.fn();
		const tester = new Glyphrow(host, { text: "Hello", lang: "en", onChange });
		const text = host.querySelector<HTMLElement>(".glyphrow__text")!;
		expect(text.getAttribute("lang")).toBe("en");
		tester.setText("Grüße", "de");
		expect(text.textContent).toBe("Grüße");
		expect(text.getAttribute("lang")).toBe("de");
		expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ text: "Grüße", lang: "de" });
		tester.setText("Hi", null);
		expect(text.hasAttribute("lang")).toBe(false);
		tester.setText("Again");
		expect(tester.getState().lang).toBeNull();
	});

	it("pastes plain text on one line", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);
		const tester = new Glyphrow(host, { text: "" });
		const text = host.querySelector<HTMLElement>(".glyphrow__text")!;
		const range = document.createRange();
		range.selectNodeContents(text);
		window.getSelection()!.removeAllRanges();
		window.getSelection()!.addRange(range);
		const event = new Event("paste", { cancelable: true }) as ClipboardEvent;
		Object.defineProperty(event, "clipboardData", {
			value: { getData: (t: string) => (t === "text/plain" ? "one\ntwo" : "<b>one</b>") },
		});
		text.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
		expect(text.innerHTML).toBe("one two");
		expect(tester.getState().text).toBe("one two");
		host.remove();
	});
});

describe("extra controls", () => {
	it("appends nodes to the end of the bar by default", () => {
		const host = document.createElement("div");
		const note = document.createElement("p");
		note.className = "glyphrow__control my-note";
		new Glyphrow(host, { controls: { size: true }, extraControls: note });
		const bar = host.querySelector(".glyphrow__controls")!;
		expect(bar.lastElementChild!.classList.contains("glyphrow__extra")).toBe(true);
		expect(bar.querySelector(".glyphrow__extra .my-note")).toBe(note);
	});

	it("puts the slot first with extraControlsPosition start", () => {
		const host = document.createElement("div");
		new Glyphrow(host, {
			controls: { size: true },
			extraControls: [document.createElement("select")],
			extraControlsPosition: "start",
		});
		expect(host.querySelector(".glyphrow__controls")!.firstElementChild!.className).toBe("glyphrow__extra");
	});

	it("renders a bar for extra controls alone, and calls a hook with the instance", () => {
		const host = document.createElement("div");
		const cleanup = vi.fn();
		const tester = new Glyphrow(host, {
			text: "Hello",
			extraControls: (slot, instance) => {
				const select = document.createElement("select");
				select.add(new Option("German", "de"));
				select.addEventListener("change", () => instance.setText("Grüße", select.value));
				slot.append(select);
				return cleanup;
			},
		});
		const select = host.querySelector<HTMLSelectElement>(".glyphrow__controls .glyphrow__extra select")!;
		select.dispatchEvent(new Event("change"));
		expect(tester.getState()).toMatchObject({ text: "Grüße", lang: "de" });
		tester.destroy();
		expect(cleanup).toHaveBeenCalled();
	});

	it("adds a slot to adopted markup rendered without one, and removes it on destroy", () => {
		container.innerHTML = renderHTML({ controls: { size: true } });
		const root = container.firstElementChild as HTMLElement;
		const node = document.createElement("span");
		const tester = new Glyphrow(root, { controls: { size: true }, extraControls: node });
		expect(root.querySelector(".glyphrow__controls .glyphrow__extra span")).toBe(node);
		tester.destroy();
		expect(root.querySelector(".glyphrow__extra")).toBeNull();
	});
});
