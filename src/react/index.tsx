// React wrapper around the framework-agnostic Glyphrow core. It renders the
// tester's full markup (from the shared view), so the sample and controls
// appear in server-rendered HTML with no blank area or layout jump; on the
// client the core adopts that markup and only attaches behaviour. React is a
// peer dependency, externalised at build time, so the core stays dependency-free.

import * as React from "react";
import { createContext, createElement, useContext, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, ReactElement, ReactNode } from "react";
import { Glyphrow as GlyphrowCore } from "../core/glyphrow.js";
import { buildView, resolveModel, type VNode } from "../core/view.js";
import type { GlyphrowOptions, GlyphrowState } from "../core/types.js";

/** Props for {@link Glyphrow}. Mirrors {@link GlyphrowOptions}. */
export interface GlyphrowProps extends GlyphrowOptions {
	/** Class applied to the host element. */
	className?: string;
	/**
	 * Extra controls rendered in the bar's slot (after the built-in controls,
	 * or before with `extraControlsPosition: "start"`). They re-render with
	 * your component; the tester itself does not rebuild.
	 */
	children?: ReactNode;
	/** Receives the core instance once mounted (null after unmount), for `setText`, `setStyle` and `getState`. */
	instanceRef?: MutableRefObject<GlyphrowCore | null>;
}

/** Carries the slot's children past the memoised tester markup. */
const SlotContext = createContext<ReactNode>(null);

/** The extra-controls slot: re-renders with the host's children while the rest stays memoised. */
function Slot({ className }: { className: string }): ReactElement {
	return createElement("div", { className }, useContext(SlotContext));
}

/** VNode attribute names that React spells differently. */
const PROP_NAMES: Record<string, string> = {
	class: "className",
	contenteditable: "contentEditable",
	spellcheck: "spellCheck",
	for: "htmlFor",
};

/** Converts a kebab-case CSS property to React's style key (custom properties unchanged). */
function styleKey(prop: string): string {
	if (prop.startsWith("--")) return prop;
	return prop.replace(/^-webkit-/, "Webkit-").replace(/-([a-z])/gi, (_, c: string) => c.toUpperCase());
}

/**
 * Converts a VNode to a React element. Form values become uncontrolled
 * defaults (`defaultValue` / `defaultChecked`) because the core, not React,
 * updates them after mount.
 */
function toReact(node: VNode, key?: number): ReactElement {
	if (node.slot) return createElement(Slot, { key, className: String(node.attrs.class) });
	const props: Record<string, unknown> = { key };
	for (const [name, value] of Object.entries(node.attrs)) {
		if (value == null || value === false) continue;
		if (node.tag === "option" && name === "selected") continue;
		if (node.tag === "input" && name === "value") props.defaultValue = value;
		else if (node.tag === "input" && name === "checked") props.defaultChecked = true;
		else props[PROP_NAMES[name] ?? name] = value === true ? (name === "hidden" ? true : "") : value;
	}
	if (node.tag === "select") {
		const chosen = node.children?.find((c) => c.attrs.selected);
		if (chosen) props.defaultValue = chosen.attrs.value;
	}
	if (node.style) {
		const style: Record<string, string> = {};
		for (const [prop, value] of Object.entries(node.style)) style[styleKey(prop)] = value;
		props.style = style;
	}
	if (props.contentEditable) props.suppressContentEditableWarning = true;
	const children = node.text != null ? [node.text] : (node.children ?? []).map((c, i) => toReact(c, i));
	return createElement(node.tag, props, ...children);
}

// React 18+ gives ids that match between server and client; older versions get
// a per-mount counter (pass `idPrefix` when server rendering on React 17).
const reactUseId: (() => string) | undefined = (React as { useId?: () => string }).useId;
let fallbackId = 0;

/** A stable, id-safe prefix for this tester's element ids. */
function useIdPrefix(given: string | undefined): string {
	const generated = reactUseId ? reactUseId() : useFallbackId();
	return given ?? `glyphrow-${generated.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

/** Per-mount id for React versions without useId. */
function useFallbackId(): string {
	const ref = useRef("");
	if (!ref.current) ref.current = `r${++fallbackId}`;
	return ref.current;
}

/**
 * Renders a tester. The markup is rendered by React (so it is in the server
 * HTML), and the core attaches to it after mount. The tester is rebuilt when a
 * structural option changes; `text` and `lang` changes are applied in place.
 */
export function Glyphrow(props: GlyphrowProps): ReactElement {
	const { className, onChange, children, instanceRef, text, lang, ...options } = props;
	const idPrefix = useIdPrefix(options.idPrefix);
	const hasExtra = children != null && children !== false;
	// Keep the latest onChange without forcing a tester rebuild on each render.
	const onChangeRef = useRef<((state: GlyphrowState) => void) | undefined>(onChange);
	onChangeRef.current = onChange;
	const coreRef = useRef<GlyphrowCore | null>(null);

	// Serialise structural options so the markup and instance only change on
	// real changes (functions and nodes in extraControls do not count).
	const key = JSON.stringify([options, idPrefix, hasExtra]);
	// The text and language the markup was rendered with; later changes go
	// through setText so typing state and the instance survive.
	const initial = useMemo(() => ({ text, lang }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
	const view = useMemo(
		() => buildView(resolveModel({ ...options, text: initial.text, lang: initial.lang }, idPrefix), { hasExtra }),
		[key], // eslint-disable-line react-hooks/exhaustive-deps
	);
	// The root's children, memoised so re-renders (e.g. new slot children) never touch the core's DOM.
	const inner = useMemo(() => (view.children ?? []).map((c, i) => toReact(c, i)), [view]);
	const hostRef = useRef<HTMLDivElement>(null);
	const applied = useRef({ text: initial.text, lang: initial.lang });

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		const instance = new GlyphrowCore(host, {
			...options,
			text: initial.text,
			lang: initial.lang,
			idPrefix,
			hydrate: true,
			onChange: (state) => onChangeRef.current?.(state),
		});
		coreRef.current = instance;
		applied.current = { text: initial.text, lang: initial.lang };
		return () => {
			instance.destroy();
			coreRef.current = null;
		};
	}, [key]); // eslint-disable-line react-hooks/exhaustive-deps

	// Point the current instanceRef at the instance; runs after the mount
	// effect, again when the ref object is replaced, and clears the old ref.
	useEffect(() => {
		if (!instanceRef) return;
		const instance = coreRef.current;
		instanceRef.current = instance;
		return () => {
			if (instanceRef.current === instance) instanceRef.current = null;
		};
	}, [instanceRef, key]);

	// Apply text/lang prop changes in place (e.g. a language-sample select).
	useEffect(() => {
		const instance = coreRef.current;
		if (!instance) return;
		if (applied.current.text === text && applied.current.lang === lang) return;
		applied.current = { text, lang };
		instance.setText(text ?? "", lang ?? null);
	}, [text, lang]);

	const rootClass = String(view.attrs.class ?? "glyphrow");
	return createElement(
		SlotContext.Provider,
		{ value: children },
		createElement(
			"div",
			{
				// A new key remounts the host, so new markup is rendered for the new options.
				key,
				ref: hostRef,
				className: className ? `${rootClass} ${className}` : rootClass,
				"data-glyphrow-rendered": "",
			},
			...inner,
		),
	);
}

// Deprecated pre-3.0 names for the React component. The old `fontproof/react`
// entry exported this component as `FontProof`; both aliases point at the
// component so a `<FontProof/>` migration keeps rendering.
/** @deprecated Renamed to {@link Glyphrow}. */
export const FontProofComponent = Glyphrow;
/** @deprecated Renamed to {@link Glyphrow}. */
export const FontProof = Glyphrow;

// The framework-agnostic core class, for consumers who want it from this entry.
export { GlyphrowCore };

export type {
	Align,
	AxisConfig,
	ControlsConfig,
	Range,
	Size,
	GlyphrowOptions,
	GlyphrowState,
	StyleOption,
	VariableConfig,
} from "../core/types.js";
export type { FeatureInput, FeatureOption, FeatureTag } from "../core/opentype.js";

// Deprecated type aliases (renamed in 3.0.0), also surfaced from the React entry.
/** @deprecated Renamed to {@link GlyphrowProps}. */
export type FontProofProps = GlyphrowProps;
export type {
	/** @deprecated Renamed to `GlyphrowOptions`. */
	GlyphrowOptions as FontProofOptions,
	/** @deprecated Renamed to `GlyphrowState`. */
	GlyphrowState as FontProofState,
} from "../core/types.js";
