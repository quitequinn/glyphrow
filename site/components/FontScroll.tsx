"use client";

// Infinite scroll of Google Fonts, each rendered as a live Glyphrow tester with
// a cycling variety of settings. Rows are appended as a bottom sentinel scrolls
// into view; the family/preset lists loop, so the scroll never ends.

import { useEffect, useRef, useState } from "react";
import { Glyphrow } from "glyphrow/react";
import { FAMILIES } from "@/lib/families";
import { PRESETS } from "@/lib/presets";
import { loadGoogleFont } from "@/lib/googleFont";

/** How many rows to append each time the sentinel is reached. */
const BATCH = 8;

/** One font row: its Google Font is loaded on mount, then tested with a preset. */
function FontRow({ family, index }: { family: string; index: number }) {
	const preset = PRESETS[index % PRESETS.length];

	useEffect(() => {
		loadGoogleFont(family);
	}, [family]);

	return (
		<article className="row">
			<header className="row__meta">
				<span className="row__family">{family}</span>
				<span className="row__preset">{preset.label}</span>
			</header>
			<Glyphrow
				fontFamily={family}
				fallback="sans-serif"
				text={preset.sample}
				className="row__proof"
				{...preset.opts}
			/>
		</article>
	);
}

/** The scrolling list. Grows as the user reaches the bottom. */
export default function FontScroll() {
	const [count, setCount] = useState(BATCH);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const node = sentinelRef.current;
		if (!node) return;
		const io = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) setCount((c) => c + BATCH);
			},
			// Preload well before the sentinel is visible so scrolling stays smooth.
			{ rootMargin: "800px 0px" },
		);
		io.observe(node);
		return () => io.disconnect();
	}, []);

	const rows = [];
	for (let i = 0; i < count; i++) {
		rows.push(<FontRow key={i} family={FAMILIES[i % FAMILIES.length]} index={i} />);
	}

	return (
		<>
			<div className="rows">{rows}</div>
			<div ref={sentinelRef} className="sentinel" aria-hidden="true">
				loading more fonts…
			</div>
		</>
	);
}
