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
npm run lint         # ESLint (includes the custom copy rule, see Key Patterns)
npm test             # `tsc --noEmit` FIRST, then the node test runner over THREE
                     # globs, not one:
                     #   src/**/*.test.ts, src/app/.well-known/**/*.test.ts, eslint-rules/*.test.mjs
                     # Hermetic and offline capable. Nothing in it touches the network.
npm run check:free-year             # NOT in `npm test`: reads the npm registry.
                                    # Runs weekly in CI. See "The free-year sentence".
node _lockcensus.cjs <before.json>   # Lockfile diff, by entry. Run it on any lockfile change.
```

### `npm test` runs `tsc --noEmit` first, and that is load-bearing

`node --experimental-strip-types` ERASES type annotations and runs the
JavaScript underneath. It never asks whether the annotations were true. So the
test runner alone cannot see a type error, and for a while this repo's only gate
could not either.

**Why that mattered more here than in most repos.** `next.config.ts` sets
neither `typescript.ignoreBuildErrors` nor `eslint.ignoreDuringBuilds`, so
`next build` DOES typecheck. Amplify is the CI for this repo, and on `stable`
that build is the **fleet** build. A type error could therefore reach `main`,
be promoted, and fail the build for **every live customer site at once**, with
the only gate the repo has reporting green the entire way.

Measured 2026-09-21, four legs, because two would not have been enough:

| Tree | `npm test` (tsc + runner) | runner alone |
|---|---|---|
| clean | rc 0, 1014 pass | rc 0, 1014 pass |
| `const x: number = 'a string'` in `src/lib/domains/publicSearch.ts` | **rc 2**, `TS2322` naming file and line | **rc 0, 1014 pass** |

The clean row is the control that the gate is not simply always failing, and
that chaining `tsc &&` did not short-circuit the suite. The bottom-right cell is
the original finding, and it is what makes the bottom-left cell mean "the
typecheck caught it" rather than "something caught it". That module is imported
by most of the domains suite, so it is not a file the runner skipped.

There were **zero** pre-existing type errors when this was wired in, so nothing
was suppressed and no bar was lowered.

**Do not "fix" a red `npm test` by dropping the `tsc --noEmit &&`.** A type
error it reports is one the fleet build would reject. `npm test` and
`npm run lint` together are the local gate.

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router). **Do not add `experimental.viewTransition`**. It was removed in the 16.3.0 bump because the flag GRADUATED, and 16.3.0 rejects the key as unrecognized. `next build` typechecks `next.config.ts`, so re-adding it is a hard build failure, not a warning. The `<ViewTransition>` wrappers in `layout.tsx` are unaffected; they import from `react` |
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
│   │                               #   validate-coupon, delivery-quote, preview/enable,
│   │                               #   revalidate (webhook cache invalidation)
│   ├── feeds/schedule.ics/route.ts # Public iCal feed for the schedule page's Subscribe button
│   ├── mcp/route.ts, .well-known/  # Site MCP + mcp.json + llms.txt
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
│   ├── og/siteOrigin.ts            # resolveSiteOrigin(siteData, {surface}): canonicalUrl → NEXT_PUBLIC_SITE_URL → live_url → domainName
│   │                               #   ONE order for both surface values; `surface` selects STRICTNESS, not order — `durable`
│   │                               #   (JSON-LD/robots/sitemap/schedule feed) also refuses a *.amplifyapp.com host.
│   │                               #   resolveSiteOriginResult() additionally returns WHY a candidate was refused
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
                               #   NOT set by the deploy pipeline: measured unset across the fleet's Amplify apps at the time
                               #   that was written, so this level was inert in production. That is an INFRASTRUCTURE snapshot,
                               #   not a property of this repo, and nothing here can re-check it. Confirm against the apps
                               #   before relying on it. The persisted `siteDetails.values.canonicalUrl` outranks it either way.
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

Pages come from portal page configs (`siteData.pageConfigs`), rendered by `[slug]/page.tsx` through the unified `composePage()` pipeline (formats listed in `COMPOSE_FORMATS`; unlisted formats keep legacy per-format JSX). Navigation auto-derives in the renderer's `deriveNav`/`deriveFooterPages`, threaded through `components/Navigation/Navbar.tsx` and `components/Footer/index.tsx` (`getNavigationData()` in `lib/api/navigation` predates that and has no callers left). Collection IDs resolve blocks-first via `getPageCollectionId()`: page-template block binding → legacy `page.collectionId` → `page.collections[0]` → env fallback.

**A page the owner turns off does not serve.** `src/lib/pages/pageEnabled.ts` owns the one reading of `pageConfig.enabled` (`=== false` exactly, absent means on, byte-identical to the renderer's nav rule so the two cannot disagree). Off that single predicate: `[slug]` answers `notFound()`, so do both arms of `[slug]/[itemId]` (the depth-2 nested page AND the detail items of an off parent), `generateStaticParams` stops prerendering it, and `buildSitemapEntries` leaves the page and its detail items out of `sitemap.xml`. Before that the flag was navigation-only, so "off" meant hidden from the menu while the page kept serving at its URL and kept being submitted to search engines. Two things it deliberately does NOT do: it does not change navigation (the navbar and footer still drop an off page in the renderer, unchanged), and it does not reach the HOME page (`/` renders from `homePageConfig`, and the sitemap root entry answers to `seo.noindex` alone).

Studio-authored chrome threads through the shells:
- **Navbar**: `navigation.headerStyle`, `navigation.headerWidth`, `navigation.secondaryCta`, `navigation.brand.logoHeight`, dark/light `siteData.chrome`
- **Footer**: `footer.socialStyle`, `footer.newsletterPlacement`, `footer.brand.logoFilter`, tagline from `footer.brand.description` (falls back to `businessInfo.description`)

### Server Components First

Pages are async Server Components that fetch data and pass it to Client Components:
- `page.tsx` → fetches data → passes to client components
- `Navbar.tsx` and `Footer` are also Server Components (they fetch nav data)

### Metadata is Dynamic

`generateMetadata()` reads `getSiteData()` per page. Studio `seo.metaTitle` is the EXACT title (no `title.template` in the root layout — the author owns the full string); `seo.metaDescription` likewise. `og:image` always points at the stable `/og/<slug>` route (proxies the page's `labels.ogImage` or generates a branded card — never emits a short-lived signed URL). Origin resolution is ONE chain in `src/lib/og/siteOrigin.ts`: `siteData.canonicalUrl` → `NEXT_PUBLIC_SITE_URL` → `domainInformation.live_url` → `https://<domainName>`, via `resolveSiteOrigin(siteData, { surface })`. Every candidate goes through the same HTTPS-origin allowlist (no path, query, fragment, credentials, port or non-public host). The required `surface` discriminant selects STRICTNESS, never order: `'durable'` (JSON-LD `url`, robots.txt `Sitemap:`, sitemap `<loc>`, the webcal schedule feed — crawler-cached) additionally refuses a `*.amplifyapp.com` candidate, `'deployed'` (metadataBase/OG — per-request) accepts it. `canonicalUrl` is demo-gated inside the resolver. The resolver cannot import Sentry (that would make it unloadable by the plain-Node test runner and cost it the suite that pins the demo gates), so `resolveSiteOriginResult()` returns the refused candidates as DATA and `getSiteData()` captures them — a refusal is never silent.

**Page-level indexing.** `src/lib/seo/pageIndexing.ts` owns the one list of page FORMATS search engines must never be pointed at (today: `checkout-success` / `checkout-cancel`). It drives both the sitemap exclusion (`buildSitemapEntries`) and the page's `robots` metadata (`[slug]/page.tsx`), because absence from a sitemap does not deindex an already-crawled URL. Keyed on `pageConfig.format`, never the slug — the live checkout slugs are `checkoutsuccess`/`checkoutcancel`.

### Copy is Lint-Enforced

`eslint-rules/owner-visible-copy.mjs` is a custom rule, registered in
`eslint.config.mjs` at **`error`** across all of `src/**`, that enforces `brand/voice.md`
on anything a visitor or owner reads: no em or en dashes, no supplier names
(`AWS`, `Amplify`, `Route 53`, `Cognito`, `DynamoDB`, `CloudFront`), no jargon, no `px`
measurements. `npm run lint` is the gate; `eslint-rules/*.test.mjs` runs under `npm test`.

Two things about it are load-bearing:

- **It reads `JSXText`, not just string literals.** Most copy on a page is the text
  between two tags, and a sweep that greps only quoted strings misses it. Thirteen live
  violations hid that way in the portal.
- **It reads `Literal` and `JSXText` AND NOTHING ELSE**, so a **template literal is
  invisible to it.** Composing a sentence with backticks and `${}` takes that sentence out
  of the dash, jargon, supplier and `px` checks in one edit, silently, with a green lint.
  That is why `FREE_YEAR_OFFER` in `src/lib/domains/publicSearch.ts` is a plain quoted
  string even though its `$25` is checked against a package value: the tests keep it in
  step with the number, and the literal is what keeps it linted. If you ever need a
  composed string that a visitor reads, teach the rule `TemplateLiteral` first, with the
  must-fail control.
- **A bare glyph is exempt** as the "no value here" placeholder (`value ?? '—'`, a lone
  `—` in a cell). The exemption is narrow on purpose, and it has now been the cause of
  two escapes: a glyph in a `{"—"}` container, and a dash written as plain JSX text with
  words beside it. Both are fixed and pinned. If you widen the exemption, add the
  must-fail control with it.

### The free-year sentence is pinned to a package this repo does not install

`src/lib/domains/publicSearch.ts` carries `FREE_YEAR_OFFER`, the one sentence vivreal.io
tells a stranger about the free first year. Its `$25` is `DOMAIN_BUNDLE.maxCatalogPriceCents`
from `@hillbombcreations/tier-quotas`, hand-copied because a second private GitHub Packages
dependency in this app's `npm ci` is a known way to brick every customer site's build.

Two checks, and neither can pass by doing nothing:

- `publicSearch.test.ts` ties every clause of the sentence to a field in `FREE_YEAR_SOURCE`,
  the recorded package reading. Hermetic. Editing the sentence or the record alone is red.
- `checks/freeYearPackage.test.ts` fetches the real package into an OS temp directory and
  asserts it still says the same thing. **That one needs the registry**, unavoidably: this
  repo does not depend on the package, so nothing local ever changes when the package moves
  and the registry is the only thing that knows. It asserts `package.json` and
  `package-lock.json` are byte identical after it runs.

  **It is deliberately NOT in `npm test`**, and lives outside `src/` so the glob cannot pick
  it up. It briefly was, and that was the wrong trade: taxing every developer on every run,
  forever, to catch a copy literal drifting, and handing the suite a way to go red when the
  wifi drops. A suite that fails for reasons unrelated to the code teaches people to distrust
  it, and a distrusted suite is the same problem as an unrun one.

  It runs **weekly** from `.github/workflows/free-year-package-check.yml`
  (`npm run check:free-year` to run it by hand). It **fails rather than skips** when the
  registry is unreachable, and that matters more in a cron than it did in `npm test`: nobody
  watches a scheduled job, so a skip is invisible, and an invisible skip is how a gate dies
  while still appearing to exist. If it goes red on AUTH rather than drift, add a
  `PACKAGES_READ_TOKEN` secret. Never disable the schedule, never make it skip.

If either goes red, read the package and move the sentence, `FREE_YEAR_SOURCE` and the
portal's copy together. Never just the number.

**`Stripe` and `Square` are deliberately NOT in the supplier list**, because an owner
connects those themselves. That rationale is about the OWNER, and it does not extend to
the SHOPPER: shopper-facing copy must never name the payment company at all, because the
group's active provider is resolved server-side and is not always the same one. The rule
cannot tell those two audiences apart, so that case is on you (see `H36`).

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

**`_lockcensus.cjs` at the repo root is what makes that visible**, and nothing above used
to name it. Copy the lockfile before the bump, then compare entry by entry:

```bash
cp package-lock.json /tmp/lock-before.json
npm install                       # or whatever moved it
node _lockcensus.cjs /tmp/lock-before.json
```

It groups by `@emnapi/`, `@img/sharp`, `linux (any)` and optional deps, prints the
renderer version either side, and **exits 1 if any Linux-critical group shrank**. Measured
2026-09-21: `main` is 720 entries, four `@emnapi/`, and `npm ci` leaves the lockfile byte
identical. Feeding the census a lockfile with the two `@emnapi/*` entries removed (the
720 to 718 shape) makes it exit 1 and name both, so its silence is a real silence.

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
