import { afterEach, describe, expect, it } from "vitest";
import { Glyphrow, FontProof, autoInit } from "../src/index.js";
import * as index from "../src/index.js";

afterEach(() => {
	document.body.replaceChildren();
});

describe("backward-compat (fontproof → glyphrow)", () => {
	it("FontProof aliases the Glyphrow core class", () => {
		expect(FontProof).toBe(Glyphrow);
		expect(index.FontProof).toBe(index.Glyphrow);
	});

	it("legacy [data-fontproof] elements are still auto-initialised", () => {
		const host = document.createElement("div");
		host.setAttribute("data-fontproof", "");
		host.dataset.text = "Hi";
		document.body.appendChild(host);

		const instances = autoInit();
		expect(instances).toHaveLength(1);
		expect(instances[0]).toBeInstanceOf(Glyphrow);
		expect(host.classList.contains("glyphrow")).toBe(true);
		expect(host.dataset.glyphrowReady).toBe("true");
	});

	it("does not re-initialise an already-ready legacy element", () => {
		const host = document.createElement("div");
		host.setAttribute("data-fontproof", "");
		host.dataset.glyphrowReady = "true";
		document.body.appendChild(host);

		expect(autoInit()).toHaveLength(0);
	});

	it("still initialises the new [data-glyphrow] attribute", () => {
		const host = document.createElement("div");
		host.setAttribute("data-glyphrow", "");
		document.body.appendChild(host);

		expect(autoInit()).toHaveLength(1);
	});
});
