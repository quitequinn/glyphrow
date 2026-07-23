// Glyphrow showcase home page: an explanation of the library up top, a live
// hero, then an infinite scroll of Google Fonts each driven by Glyphrow.

import Hero from "@/components/Hero";
import FontScroll from "@/components/FontScroll";

const REPO = "https://github.com/quitequinn/glyphrow";

export default function Home() {
	return (
		<main>
			<section className="intro">
				<p className="eyebrow">Open-source · dependency-free · accessible</p>

				<h1 className="sr-only">Glyphrow</h1>
				<div className="hero">
					<Hero />
				</div>
				<p className="hero__hint" aria-hidden="true">
					↑ Click the wordmark and drag the controls — it&rsquo;s a real Glyphrow instance.
				</p>

				<p className="lede">
					<strong>Glyphrow</strong> is a type tester for the web: a tiny vanilla-JS core
					with an optional React wrapper, no dependencies, and native, keyboard- and
					screen-reader-accessible controls. Composable OpenType features, variable-font
					axes, auto-fit sizing — drop it on any element and start testing type.
				</p>

				<ul className="features" aria-label="Features">
					<li>Zero dependencies · ~5&nbsp;kB core</li>
					<li>Composable OpenType features</li>
					<li>Variable-font axis sliders</li>
					<li>Auto-fit sizing via ResizeObserver</li>
					<li>Accessible native controls</li>
					<li>Vanilla or React</li>
				</ul>

				<div className="install">
					<code>npm i glyphrow</code>
				</div>

				<nav className="links" aria-label="Project links">
					<a href={REPO}>GitHub</a>
					<a href="https://www.npmjs.com/package/glyphrow">npm</a>
					<a href={`${REPO}#readme`}>Docs</a>
				</nav>
			</section>

			<section className="showcase" aria-labelledby="showcase-title">
				<div className="showcase__head">
					<h2 id="showcase-title">Every Google Font, live</h2>
					<p>
						Each row is a real Glyphrow instance testing a Google Font, cycling through
						different settings — sizes, features, alignment, weights, auto-fit. Focus any
						row to reveal its controls. Keep scrolling: the list loops forever.
					</p>
				</div>
				<FontScroll />
			</section>

			<footer className="foot">
				<span>
					Glyphrow — by <a href="https://liiift.studio/">Quinn Keaveney</a>
				</span>
				<a href={REPO}>Source on GitHub</a>
			</footer>
		</main>
	);
}
