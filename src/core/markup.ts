// Renderers for the VNode tree: DOM (vanilla core) and an HTML string (server
// rendering without React). Both escape all text and attribute values.

import { buildView, resolveModel, type VNode } from "./view.js";
import type { GlyphrowOptions } from "./types.js";

/** Elements that never have children or a closing tag. */
const VOID = new Set(["input"]);

/**
 * Builds DOM for a VNode. Text is set via textContent and attributes via
 * setAttribute, so values are never parsed as HTML.
 * @param node The node to build.
 */
export function toDOM(node: VNode): HTMLElement {
	const element = document.createElement(node.tag);
	applyAttrs(element, node);
	if (node.text != null) element.textContent = node.text;
	for (const child of node.children ?? []) element.appendChild(toDOM(child));
	return element;
}

/** Writes a VNode's attributes and inline style onto an element. */
export function applyAttrs(element: HTMLElement, node: VNode): void {
	for (const [name, value] of Object.entries(node.attrs)) {
		if (value == null || value === false) continue;
		element.setAttribute(name, value === true ? "" : String(value));
	}
	for (const [prop, value] of Object.entries(node.style ?? {})) element.style.setProperty(prop, value);
}

/** Escapes text for HTML element content. */
function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Escapes a value for a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
	return escapeText(value).replace(/"/g, "&quot;");
}

/**
 * Whether a CSS value can be written into a style attribute as one
 * declaration: no `;`, braces or comment openers that could end it or start
 * another (values reaching here are already validated; this is a backstop).
 */
function isSafeStyleValue(value: string): boolean {
	return !/[;{}]|\/\*/.test(value);
}

/**
 * Serialises a VNode to an HTML string.
 * @param node The node to serialise.
 */
export function toHTML(node: VNode): string {
	let attrs = "";
	for (const [name, value] of Object.entries(node.attrs)) {
		if (value == null || value === false) continue;
		attrs += value === true ? ` ${name}=""` : ` ${name}="${escapeAttr(String(value))}"`;
	}
	const style = Object.entries(node.style ?? {})
		.filter(([prop, value]) => /^-{0,2}[A-Za-z][\w-]*$/.test(prop) && isSafeStyleValue(value))
		.map(([prop, value]) => `${prop}: ${value}`)
		.join("; ");
	if (style) attrs += ` style="${escapeAttr(style)}"`;
	if (VOID.has(node.tag)) return `<${node.tag}${attrs}>`;
	const inner = node.text != null ? escapeText(node.text) : (node.children ?? []).map(toHTML).join("");
	return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

/** Count of renderHTML calls, for unique default id prefixes (1 and up). */
let renderCount = 0;

/** Options for {@link renderHTML}. */
export interface RenderOptions {
	/** Prefix for element ids. Defaults to a new "glyphrow-ssr-N" per call, so several testers on a page never share ids. */
	idPrefix?: string;
}

/**
 * Renders a tester's full initial markup as HTML — the host `div` with the
 * sample at its size and the controls bar — for server rendering. On the
 * client, `new Glyphrow(thatDiv, sameOptions)` adopts it instead of
 * rebuilding. Extra controls are rendered as an empty slot to be filled on
 * the client (or by your own server template).
 * @param options The same options the client will use.
 * @param render Id prefix.
 */
export function renderHTML(options: GlyphrowOptions, render: RenderOptions = {}): string {
	const idPrefix = options.idPrefix ?? render.idPrefix ?? `glyphrow-ssr-${++renderCount}`;
	return toHTML(buildView(resolveModel(options, idPrefix)));
}
