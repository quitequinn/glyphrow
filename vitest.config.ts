import { defineConfig } from "vitest/config";

// Tests run under jsdom so the DOM-building core can be exercised headlessly.
export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
	},
});
