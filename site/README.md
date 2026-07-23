# Glyphrow — showcase site

The site behind [glyphrow.com](https://glyphrow.com): an explanation of the
library, a live variable-font hero, and an **infinite scroll of Google Fonts**
where every row is a real [`glyphrow`](https://www.npmjs.com/package/glyphrow)
tester cycling through different settings.

## Stack

- Next.js (App Router), React 18
- Consumes the published `glyphrow` package (`glyphrow` + `glyphrow/react` + `glyphrow/styles.css`)
- Google Fonts loaded lazily per row as the scroll advances (no API key)

## Develop

```bash
cd site
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Deploy (Vercel)

This app lives in the `site/` subdirectory of the repo. In the Vercel project:

- **Root Directory:** `site`
- **Framework preset:** Next.js (auto-detected)
- Assign the `glyphrow.com` domain to the project.

## Layout

- `app/` — layout, page, global styles
- `components/Hero.tsx` — the wordmark, a live Glyphrow of Fraunces (variable)
- `components/FontScroll.tsx` — the infinite Google-Fonts scroll
- `lib/families.ts` — curated Google Fonts list (the scroll loops it)
- `lib/presets.ts` — the settings cycled across rows
- `lib/googleFont.ts` — lazy per-family stylesheet loader
