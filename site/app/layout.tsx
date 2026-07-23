// Root layout: global metadata and stylesheet imports. Glyphrow's own base
// styles load first so the site stylesheet can layer on top.

import type { Metadata } from "next";
import "glyphrow/styles.css";
import "./globals.css";

export const metadata: Metadata = {
	metadataBase: new URL("https://glyphrow.com"),
	title: "Glyphrow — accessible, dependency-free type tester",
	description:
		"Glyphrow is a dependency-free, accessible type tester for the web — vanilla JS core with an optional React wrapper. See it running on an infinite scroll of Google Fonts.",
	openGraph: {
		title: "Glyphrow — accessible, dependency-free type tester",
		description:
			"A dependency-free, accessible type tester for the web. Live on an infinite scroll of Google Fonts.",
		url: "https://glyphrow.com",
		siteName: "Glyphrow",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Glyphrow — type tester",
		description: "Dependency-free, accessible type tester for the web.",
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
