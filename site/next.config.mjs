// Next.js config for the Glyphrow showcase site.
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Glyphrow ships prebuilt ESM in dist/, but transpiling it keeps Next happy
	// when consuming the package (and its CSS export).
	transpilePackages: ["glyphrow"],
	// Root file tracing at this app so nearby lockfiles aren't mistaken for the
	// workspace root (silences the multi-lockfile inference warning).
	outputFileTracingRoot: here,
};

export default nextConfig;
