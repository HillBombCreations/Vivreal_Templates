# GEMINI.md — Vivreal_Templates

Gemini-optimized digest. For full detail see `CLAUDE.md` **on the currently
checked-out branch** — each template branch has its own CLAUDE.md.

---

## What this repo is

A collection of **Next.js 15 site templates** for Vivreal customer sites.
Each branch is a different template type:

| Branch | Template |
|---|---|
| `main` | Landing-page template |
| `basic` | Basic content site |
| `ecommerce-v2` | E-commerce (Stripe products + checkout) |
| `showcase` | Content-driven (events, team, reviews, subscription) |

User sites are **auto-created** by `Vivreal_EventHandler` as branches off the
matching template branch. A GitHub Actions sync workflow merges template-branch
changes to all user site branches automatically.

---

## Tech stack (all branches share)

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| UI primitives | Radix UI |
| Animations | Framer Motion |
| Data | Server-side fetch via `clientFetch` — all API calls server-only |
| State | React Context (`SiteDataContext`) for branding / colors |

---

## Data flow

### VR_Client_API integration

All data goes through `src/lib/api/client.ts`:

- `clientFetch<T>(path)` — fetches, unwraps `{ success, data, error }`
- `clientFetchSafe<T>(path, fallback)` — same but returns fallback on error

All API calls are **server-side only** (`"server-only"` import enforced).

### Response envelope
```json
{ "success": true, "data": <payload>, "error": null }
```
Collection endpoints: `data: { items: [...], totalCount: N }`

### Media URLs
Served via CloudFront signed URLs (`media.vivreal.io`). Templates use
`currentFile.source` (returned in each media field) directly — **never build
CDN URLs manually.**

`getSignedUrl(item.objectValue.poster)` is the helper — just extracts
`currentFile.source`.

---

## Branding is fully data-driven

- Colors from `siteData` (primary, secondary, surface, etc.) — injected as
  CSS vars at runtime in `Providers/index.tsx`
- Logo from `getSignedUrl(siteData.logo)`
- Site name from `siteData.businessInfo.name` or `siteData.name`
- Social links from `siteData.socialLinks[]`
- Contact email from `siteData.businessInfo.contactInfo.email`

**No hardcoded brand names, colors, or logos.** Anywhere.

### Metadata
`generateMetadata()` reads `getSiteData()` → builds titles, descriptions,
OG tags dynamically.

---

## Environment variables

Injected by EventHandler into Amplify app — **never committed here**:

```
NEXT_PUBLIC_CLIENT_API   # VR_Client_API base URL
API_KEY                  # Per-group API key
SITE_ID                  # Mongo site document ID
BUCKET_NAME              # S3 bucket for this group
CDN_BASE_URL             # default: https://media.vivreal.io
# Per-branch collection IDs:
SHOWS_ID, TEAMMEMBERS_ID, ...
# Optional:
STRIPE_SECRET_KEY        # From integrationKey param (ecommerce only)
```

Amplify build config is **not in this repo** — it's in `Vivreal_EventHandler`.

---

## Template branch model

- **Branches** in this repo = **template types**
- User-site branches are auto-created by EventHandler off template branches
  (e.g. `showcase/doug-s-kitchen`)
- GitHub Actions sync merges template-branch commits into all matching user
  site branches
- **Never commit client-specific content** — everything must be data-driven

---

## Updating `@vivreal/site-renderer`

The shared rendering package is installed from GitHub. After pushing to
`vivreal-site-renderer` master:

```bash
rm -rf .next node_modules/@vivreal/site-renderer
npm install "github:HillBombCreations/vivreal-site-renderer#master" --install-links
npm run dev
```

**Why `--install-links`?** Turbopack can't resolve symlinked deps; the flag
forces a real copy.

**Why clear `.next`?** Turbopack caches aggressively; update without clearing
and changes won't appear.

---

## Adding new pages

1. Create route at `src/app/{page}/page.tsx` (server component that fetches
   data)
2. Add nav entry in `src/lib/api/navigation/index.tsx` `DEFAULT_NAV`
3. Page fetches any collection by env-var-supplied ID

---

## Things to know

- Next.js 15 — **older** than the portal's Next.js 16. Don't assume feature
  parity.
- All API calls are server-side only — `"server-only"` import keeps them out
  of client bundles.
- Sites use CloudFront signed URLs — unsigned CDN access returns 403.
- Each template branch has its own `CLAUDE.md` with branch-specific
  details (e.g. `showcase/CLAUDE.md` lists shows/team/reviews routes;
  `ecommerce-v2/CLAUDE.md` covers checkout flow).

---

## Docs pointers

- `CLAUDE.md` (branch-specific) — structural details of the current template
- Sibling repos: `Vivreal_EventHandler` (deploys user-site branches off
  here), `VR_Client_API` (content source), `VR_Client_Auth` (gates the API)
