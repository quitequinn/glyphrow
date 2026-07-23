"use client";

// The hero is itself a live Glyphrow — the wordmark "Glyphrow" set in the
// variable font Fraunces, with weight, optical-size, SOFT and WONK axis sliders
// (revealed on focus) so the first thing a visitor sees is the tool working.

import { useEffect } from "react";
import { Glyphrow } from "glyphrow/react";
import { loadGoogleFont } from "@/lib/googleFont";

export default function Hero() {
	useEffect(() => {
		// css2 axis order: registered (opsz, wght) then custom (SOFT, WONK).
		loadGoogleFont("Fraunces", "opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1");
	}, []);

	return (
		<Glyphrow
			fontFamily="Fraunces"
			fallback="Georgia, serif"
			text="Glyphrow"
			size="fit"
			weight={520}
			variable={{
				wght: { min: 100, max: 900, default: 520 },
				opsz: { min: 9, max: 144, default: 144, label: "Optical" },
				SOFT: { min: 0, max: 100, default: 0, label: "Soft" },
				WONK: { min: 0, max: 1, step: 1, default: 1, label: "Wonk" },
			}}
			controls={{ weight: true, axes: true, tracking: true, features: true }}
			showValues
			ariaLabel="Editable Glyphrow wordmark"
			className="hero__proof glyphrow--dark"
		/>
	);
}
