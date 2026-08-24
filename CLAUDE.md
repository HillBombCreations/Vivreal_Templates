# CLAUDE.md — Vivreal Universal Site Template

## What This Is

The **universal** site template on `main` — a Next.js 16 site that renders ANY Vivreal customer site from Studio-authored page configs via `@hillbombcreations/site-renderer` (`composePage()` + page templates). Fully data-driven: all branding, theming, pages, content, and navigation come from the Vivreal CMS via VR_Client_API.

`Vivreal_Templates` has exactly two long-lived branches: `main` (development) and `stable` (the release channel). Every customer site's Amplify app builds from the shared `stable` branch — per-customer branches no longer exist. Releases ship via the manual `promote-stable` workflow, which fast-forwards `main` → `stable` and rebuilds the entire fleet. **Never push WIP to `main`** — work on feature branches; promote `main` → `stable` only when it's ready for every live customer site.

---

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run dev:linked   # Dev against local ../vivreal-site-renderer (copies build via dev-sync.js)
npm run build        # Production build (Turbopack)
npm run lint         # ESLint
npm test             # Node test runner (src/**/*.test.ts)
```

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `experimental.viewTransition`) |
| Rendering engine | `@hillbombcreations/site-renderer` (composePage, page templates, skeletons) — version in package.json |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| UI Components | Radix UI primitives |
| Animations | Framer Motion |
| Monitoring | `@sentry/nextjs` (sourcemap upload disabled for templates) |
| Data | Server-side fetch via `clientFetch`/`clientFetchCached` (all API calls are server-only) |
| State | React Context (SiteDataContext) — site branding/config only |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — composePage(homePageConfig), welcome fallback
│   ├── layout.tsx                  # Root layout — siteData, SSR theme vars, fonts, analytics, FABs, EmailPopup
│   ├── [slug]/page.tsx             # Universal page route — Studio pageConfigs via composePage()
│   │                               #   (COMPOSE_FORMATS set gates which formats use the unified pipeline)
│   ├── [slug]/[itemId]/page.tsx    # Detail route — collection items (shows/team/products/collection-list)
│   │                               #   + depth-2 nested pages (pageConfig.slug = "features/ai-sites")
│   ├── og/[slug]/route.tsx         # Dynamic OG image — proxies labels.ogImage or generates a branded card
│   ├── api/                        # Proxy routes: review, subscribe, shows, contact, checkout,
│   │                               #   validate-coupon, revalidate (webhook cache invalidation)
│   ├── feeds/schedule.ics/route.ts # Public iCal feed for the schedule page's Subscribe button
│   ├── mcp/route.ts, .well-known/  # Site MCP + mcp.json + llms.txt
│   ├── loading.tsx, [slug]/loading.tsx  # Page-shaped Suspense skeletons (palette-correct via SSR theme vars)
│   ├── robots.tsx, sitemap.tsx
│   └── icon.tsx, apple-icon.tsx    # Dynamic favicon from siteData
├── components/
│   ├── Navigation/, Footer/        # Chrome shells — thread Studio nav/footer config to the renderer
│   ├── PageTemplates/              # Format-specific composed pages (products, schedule, subscribe, …)
│   ├── HomeSections/               # Home composition sections + EmailPopup
│   ├── SiteAnalytics/, SiteBeacon/ # Two distinct analytics paths — see Key Patterns
│   ├── JsonLd/                     # Structured data (site + detail; strips signed-URL params)
│   └── Providers/                  # QueryClient, CSS var injection, renderer context (onSubscribe, cart)
├── lib/
│   ├── api/                        # client.ts, siteData/, composition/buildPageContext, per-domain fetchers
│   ├── og/siteOrigin.ts            # resolveSiteOrigin(siteData, {prefer}): canonicalUrl → NEXT_PUBLIC_SITE_URL → live_url → domainName
│   │                               #   ONE order for both prefer values; `durable` (JSON-LD/robots/sitemap) also refuses a *.amplifyapp.com host
│   ├── og/ogImage.ts               # server-only re-export of the resolver + buildOgImageUrl
│   ├── fonts/siteFont.ts           # Per-site font resolution from siteData.fontFamily
│   ├── pages/                      # pageConfig lookup helpers (getPageBySlug, getItemHref)
│   └── renderComposedPage.tsx      # composePage output → JSX + skeletonPropsFor()
├── types/, contexts/, hooks/
├── data/mockData.ts                # Fallback mock data (used only if API unavailable)
└── styles/globals.css              # Tailwind base + CSS variables + font preset @import
```

---

## Data Flow

### VR_Client_API Integration

All data fetching goes through `src/lib/api/client.ts`:

1. **`clientFetch<T>(path)`** — fetches from VR_Client_API, unwraps `{ success, data, error }` envelope
2. **`clientFetchSafe<T>(path, fallback)`** — same but returns fallback on error
3. **`clientFetchCached<T>(path, fallback, ttl, …, tags)`** — Next.js Data Cache read. TTL from `SITE_CACHE_TTL_SECONDS` (default 60s, safe under VR_Client_API's 300s signed-URL TTL). Tag-invalidated on Studio edits via `POST /api/revalidate` (HMAC-signed webhook from VR_Secure_API). Portal preview requests (`?vivreal_preview=<token>`, relayed by middleware) bypass the cache and quota tracking.

`isQuotaError()` detects 402 quota responses — the root layout renders `<QuotaExceeded />` instead of crashing.

### API Response Format

VR_Client_API wraps all responses in an envelope:
```json
{ "success": true, "data": <payload>, "error": null }
```

Collection endpoints return paginated data inside `data`:
```json
{ "items": [...], "totalCount": 5 }
```

### Media URLs — CloudFront Signed Only

All media is served via CloudFront CDN (`media.vivreal.io`) with **signed URLs**. Unsigned URLs return 403.

VR_Client_API generates signed URLs for any media field listed in `objectValue.mediaFields` (or `siteDetails.values.mediaFields` for site data). The signed URL is returned in `currentFile.source`.

**Pattern**: `getSignedUrl(item.objectValue.poster)` — extracts `currentFile.source` from any media field (handles variant shapes too).

**Key rule**: Never build CDN URLs manually. Always use `currentFile.source` via `getSignedUrl()`.

---

## Environment Variables

```env
NEXT_PUBLIC_CLIENT_API         # VR_Client_API base URL (default https://client.vivreal.io)
API_KEY                        # API key for VR_Client_API authorization
SITE_ID                        # MongoDB site document ID; 'preview' in local/preview (disables SiteBeacon)
NEXT_PUBLIC_SITE_URL           # Optional per-site origin override (CloudFront rewrites Host — never derive from request).
                               #   NOT set by the deploy pipeline: verified unset on all 20 fleet Amplify apps, so this level is
                               #   currently inert in production. The persisted `siteDetails.values.canonicalUrl` outranks it.
SITE_CACHE_TTL_SECONDS         # Data Cache TTL (default 60; 86400 only after raising signed-URL TTL)
REVALIDATE_WEBHOOK_SECRET      # HMAC secret for /api/revalidate webhook verification
NEXT_PUBLIC_ANALYTICS_ENDPOINT # SiteBeacon collector override (default https://collect.vivreal.io/e)
NEXT_PUBLIC_SENTRY_DSN         # Sentry DSN
SHOWS_ID / TEAMMEMBERS_ID / PARTNERS_ID  # Legacy collection-ID fallbacks (block bindings win — see getPageCollectionId)
```

All env vars are injected by the EventHandler during Amplify deployment — they are NOT stored in this repo.

---

## Key Patterns

### All Branding is Data-Driven

- **Colors**: theme tokens (`primary`, `secondary`, `hover`, `surface`, `surface-alt`, `text-*`) are SSR'd as CSS vars on `<html>` (`themeVarStyle` in layout.tsx) so first paint + skeletons are palette-correct; the Providers client effect re-stamps the same values post-hydration
- **Fonts**: `siteData.fontFamily` → `resolveSiteFont()` — curated families map to the existing globals.css Google Fonts @import; only Geist loads via `next/font/google`; arbitrary families get a best-effort runtime `<link>`. Absent ⇒ no font wiring at all (Outfit default)
- **Favicon**: `siteData.favicon` sets metadata `icons` only when present
- **Style variant**: `siteData.styleVariant` → `data-style-variant` attribute on `<html>`
- **Logo / name / social / contact**: from siteData as before, via `getSignedUrl` for media

No hardcoded brand names, colors, or logos anywhere in the template.

### Pages are Studio-Authored

Pages come from portal page configs (`siteData.pageConfigs`), rendered by `[slug]/page.tsx` through the unified `composePage()` pipeline (formats listed in `COMPOSE_FORMATS`; unlisted formats keep legacy per-format JSX). Navigation auto-derives in `getNavigationData()` (respects `displayOnHeader`, excludes `static` pages). Collection IDs resolve blocks-first via `getPageCollectionId()`: page-template block binding → legacy `page.collectionId` → `page.collections[0]` → env fallback.

Studio-authored chrome threads through the shells:
- **Navbar**: `navigation.headerStyle`, `navigation.headerWidth`, `navigation.secondaryCta`, `navigation.brand.logoHeight`, dark/light `siteData.chrome`
- **Footer**: `footer.socialStyle`, `footer.newsletterPlacement`, `footer.brand.logoFilter`, tagline from `footer.brand.description` (falls back to `businessInfo.description`)

### Server Components First

Pages are async Server Components that fetch data and pass it to Client Components:
- `page.tsx` → fetches data → passes to client components
- `Navbar.tsx` and `Footer` are also Server Components (they fetch nav data)

### Metadata is Dynamic

`generateMetadata()` reads `getSiteData()` per page. Studio `seo.metaTitle` is the EXACT title (no `title.template` in the root layout — the author owns the full string); `seo.metaDescription` likewise. `og:image` always points at the stable `/og/<slug>` route (proxies the page's `labels.ogImage` or generates a branded card — never emits a short-lived signed URL). Origin resolution is ONE chain in `src/lib/og/siteOrigin.ts`: `siteData.canonicalUrl` → `NEXT_PUBLIC_SITE_URL` → `domainInformation.live_url` → `https://<domainName>`, via `resolveSiteOrigin(siteData, { prefer })`. Every candidate goes through the same HTTPS-origin allowlist (no path, query, fragment, credentials, port or non-public host). The required `prefer` discriminant does NOT reorder the chain: `'durable'` (JSON-LD `url`, robots.txt `Sitemap:`, sitemap `<loc>` — crawler-cached) additionally refuses a `*.amplifyapp.com` candidate, `'deployed'` (metadataBase/OG — per-request) accepts it. `canonicalUrl` is demo-gated inside the resolver.

### Analytics — Two Distinct Components

- **`SiteAnalytics`** (server, in `<head>`): emits the customer's OWN third-party tag from `siteData.analytics` `{ provider: 'google_analytics' | 'plausible' | 'fathom', trackingId }`. Provider IDs are validated fail-closed (GA4 id is interpolated into an inline script). Absent config ⇒ renders nothing
- **`SiteBeacon`** (client): Vivreal's first-party cookieless page-view beacon → `collect.vivreal.io/e` via `sendBeacon` (keepalive-fetch fallback). Fires only when `SITE_ID` is set and ≠ `'preview'`; every failure is swallowed — analytics must never break the site

### Config-Driven Extras

- `siteData.floatingCta` → site-wide get-in-touch FAB; `siteInfo.templateType === 'restaurant'` → Reserve-a-Table FAB
- `siteData.emailPopup` → EmailPopup (mounted in layout; absent config ⇒ legacy home-only behavior)
- Inline hero/footer email capture uses the SAME subscribe path as the popup — Providers inject `onSubscribe` into the renderer context

---

## Adding New Pages

Pages are Studio-authored, not hardcoded: create the page config in the portal and `[slug]/page.tsx` renders it — nav, metadata, and OG image come for free. Only touch code for a genuinely new page **format**: add it to the renderer's `composePage()` and to `COMPOSE_FORMATS` in `src/app/[slug]/page.tsx`.

---

## Updating `@hillbombcreations/site-renderer`

The renderer is published to GitHub Packages (`.npmrc` scopes `@hillbombcreations` to `npm.pkg.github.com`; auth via `NODE_AUTH_TOKEN`). To pick up a release:

```bash
# 1. Bump the version in package.json, then
npm install

# 2. Verify package-lock.json regenerated cleanly — Amplify runs `npm ci`,
#    and a stale/partial lockfile is the most common CI failure. If npm ci
#    reports integrity errors, delete node_modules + package-lock.json and
#    reinstall from a clean tree.
```

npm 10/11 prune the `@emnapi/*` transitive entries from package-lock.json, which has repeatedly broken the `stable` fleet build — test any lockfile change with a clean install (delete node_modules, then `npm ci`) before merging.

For local development against a renderer working copy, use `npm run dev:linked` — it copies the `../vivreal-site-renderer` build in via `dev-sync.js` (no symlinks, so Turbopack resolution stays intact). `transpilePackages` in next.config already includes the renderer.

---

## Template Branch Model

- `main` = the **single universal template** (development branch). There are no separate showcase/ecommerce template branches — one template renders every site type from config
- `stable` = the **release channel**. Every customer site's Amplify app builds from the shared `stable` branch — per-customer site branches no longer exist
- `.github/workflows/promote-stable.yml`: manual `workflow_dispatch` that fast-forwards `main` → `stable` (GitHub App installation token, `promote-stable` concurrency group with `cancel-in-progress: false`, `git merge-base --is-ancestor` guard + non-force push) — a promotion rebuilds the **entire fleet**
- Do all work on feature branches, merge to `main` when integration-ready; promote `main` → `stable` only when it's ready for every customer site
- **Never commit client-specific content** — everything must be data-driven

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
