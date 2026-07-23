import { afterEach, describe, expect, it } from "vitest";
import { autoInit, createFromElement } from "../src/index.js";

afterEach(() => {
	document.body.replaceChildren();
});

describe("dataset auto-init", () => {
	it("parses data-* attributes into options", () => {
		const host = document.createElement("div");
		host.setAttribute("data-glyphrow", "");
		host.dataset.font = "Inter";
		host.dataset.size = "48";
		host.dataset.weight = "600";
		host.dataset.align = "center";
		host.dataset.features = "smcp, onum";
		host.dataset.controls = "size,weight,features";
		document.body.appendChild(host);

		const tester = createFromElement(host);
		const state = tester.getState();
		expect(state.size).toBe(48);
		expect(state.weight).toBe(600);
		expect(state.align).toBe("center");
		expect(state.features).toEqual(["smcp", "onum"]);
		expect(host.querySelector(".glyphrow__slider--size")).not.toBeNull();
		expect(host.querySelector(".glyphrow__slider--weight")).not.toBeNull();
		expect(host.querySelector(".glyphrow__control--features")).not.toBeNull();
	});

	it("parses data-show-values", () => {
		const host = document.createElement("div");
		host.setAttribute("data-glyphrow", "");
		host.dataset.showValues = "true";
		host.dataset.controls = "size";
		document.body.appendChild(host);
		createFromElement(host);
		expect(host.classList.contains("glyphrow--show-values")).toBe(true);
	});

	it("auto-inits all marked elements once (idempotent)", () => {
		document.body.innerHTML = `
			<div data-glyphrow data-size="40"></div>
			<div data-glyphrow data-size="60"></div>
		`;
		expect(autoInit().length).toBe(2);
		// Second pass should find nothing new.
		expect(autoInit().length).toBe(0);
	});

	it("initialises only within the given subtree", () => {
		const outside = document.createElement("div");
		outside.setAttribute("data-glyphrow", "");
		document.body.appendChild(outside);
		const container = document.createElement("section");
		const inside = document.createElement("div");
		inside.setAttribute("data-glyphrow", "");
		container.appendChild(inside);
		document.body.appendChild(container);

		expect(autoInit(container).length).toBe(1);
		expect(inside.dataset.glyphrowReady).toBe("true");
		expect(outside.dataset.glyphrowReady).toBeUndefined();
	});

	it("supports auto-fit mode without throwing", () => {
		const host = document.createElement("div");
		host.setAttribute("data-glyphrow", "");
		host.dataset.size = "fit";
		document.body.appendChild(host);
		const tester = createFromElement(host);
		expect(tester.getState().fit).toBe(true);
	});
});
