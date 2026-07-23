// Lazily injects a Google Fonts stylesheet <link> for a family, once each.
// Used by the infinite scroll so each font's CSS is only requested when the
// row that needs it comes into view.

const requested = new Set<string>();

/**
 * Ensures the given Google Fonts family is loaded. Idempotent per family.
 * Optionally appends a css2 axis spec (e.g. "wght@100..900") for variable
 * fonts; omit it to load the family's default face (robust for any font).
 */
export function loadGoogleFont(family: string, axisSpec?: string): void {
	if (typeof document === "undefined") return;
	const key = axisSpec ? `${family}::${axisSpec}` : family;
	if (requested.has(key)) return;
	requested.add(key);

	const name = family.trim().replace(/\s+/g, "+");
	const spec = axisSpec ? `${name}:${axisSpec}` : name;
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
	document.head.appendChild(link);
}
