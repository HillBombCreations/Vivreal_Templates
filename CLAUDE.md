# CLAUDE.md — Vivreal Showcase Template

## What This Is

The **showcase** template — a Next.js 15 site template for content-driven businesses. It supports events/shows, team pages, reviews, and email subscriptions. Designed to be fully data-driven: all branding, content, and navigation come from the Vivreal CMS via VR_Client_API.

This is a **template branch** in `Vivreal_Templates`. Each branch is a reusable template type. The EventHandler creates user site branches off template branches, and a GitHub Actions sync workflow propagates template changes to all matching user sites.

---

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
```

---

## Tech Stack

| Area | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| UI Components | Radix UI (Sheet, Tooltip, NavigationMenu) |
| Animations | Framer Motion |
| Data | Server-side fetch via `clientFetch` (all API calls are server-only) |
| State | React Context (SiteDataContext) — site branding/colors only |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home — hero section + content listing
│   ├── layout.tsx                  # Root layout — fetches siteData, wraps in Providers
│   ├── shows/                      # Content listing page
│   │   ├── page.tsx                # Server: fetches shows, splits upcoming/past
│   │   ├── ShowPageClient.tsx      # Client: renders content grid
│   │   └── [showId]/page.tsx       # Content detail page
│   ├── team/                       # Team page
│   │   ├── page.tsx                # Server: fetches team members
│   │   └── AboutClient.tsx         # Client: renders team grid
│   ├── review/                     # Review submission page
│   │   ├── page.tsx                # Server wrapper
│   │   └── ReviewClient.tsx        # Client: review form
│   ├── terms/page.tsx              # Static terms of service
│   ├── api/
│   │   ├── review/route.tsx        # POST proxy — creates review via CMS
│   │   └── subscribe/route.tsx     # POST proxy — subscribes email via CMS
│   ├── icon.tsx                    # Dynamic favicon from siteData
│   └── apple-icon.tsx              # Dynamic Apple icon from siteData
├── components/
│   ├── Navigation/
│   │   ├── Navbar.tsx              # Server: fetches nav + siteData, renders header
│   │   ├── NavigationMenu.tsx      # Client: desktop nav with active-state underline
│   │   ├── MobileNavigationMenuClient.tsx  # Client: mobile hamburger trigger
│   │   └── MobileNavigationMenu.tsx        # Client: slide-out Sheet menu
│   ├── HeroSection/
│   │   └── index.tsx               # Client: hero banner + upcoming/past content cards
│   ├── CTASection/index.tsx        # Client: call-to-action banner (review prompt)
│   ├── EmailListComponent/index.tsx # Client: email subscription popup (auto-shows after 3s)
│   ├── Footer/index.tsx            # Server: site footer with nav, social links, Vivreal badge
│   ├── Providers/index.tsx         # Client: QueryClient, Tooltip, Toasters, CSS var injection
│   └── ui/                         # Radix UI primitives (Button, Card, Sheet, etc.)
├── contexts/
│   └── SiteDataContext.tsx         # SiteData React Context
├── lib/
│   ├── api/
│   │   ├── client.ts               # Centralized VR_Client_API fetch with envelope unwrapping
│   │   ├── media.ts                # getSignedUrl() — signed CloudFront URLs from API
│   │   ├── siteData/index.tsx      # getSiteData(), getSiteMap()
│   │   ├── shows/index.tsx         # getShows(), getShowById()
│   │   ├── team/index.tsx          # getTeamMembers()
│   │   ├── navigation/index.tsx    # getNavigationData()
│   │   ├── review/index.tsx        # createReview() — server-side
│   │   ├── review/client.tsx       # createReview() — client-side (calls /api/review)
│   │   ├── subscribe/index.tsx     # subscribeUser() — server-side
│   │   └── subscribe/client.tsx    # subscribeUser() — client-side (calls /api/subscribe)
│   └── utils/
├── types/
│   ├── SiteData/index.tsx          # SiteData, CMSSiteData, Businessinfo, SocialLink
│   ├── Shows/index.tsx             # ShowData, CMSShowData
│   ├── Team/index.tsx              # TeamData, CMSTeamData
│   ├── Navigation/index.tsx        # NavigationData, NavItem
│   └── Reviews/index.tsx           # ReviewData
├── data/
│   └── mockData.ts                 # Fallback mock data (used only if API unavailable)
└── styles/
    └── globals.css                 # Tailwind base + CSS variables + custom utilities
```

---

## Data Flow

### VR_Client_API Integration

All data fetching goes through `src/lib/api/client.ts`:

1. **`clientFetch<T>(path)`** — fetches from VR_Client_API, unwraps `{ success, data, error }` envelope
2. **`clientFetchSafe<T>(path, fallback)`** — same but returns fallback on error

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

**Pattern**: `getSignedUrl(item.objectValue.poster)` — extracts `currentFile.source` from any media field.

**Key rule**: Never build CDN URLs manually. Always use `currentFile.source` via `getSignedUrl()`.

---

## Environment Variables

```env
NEXT_PUBLIC_CLIENT_API   # VR_Client_API base URL (e.g., https://client.vivreal.io)
API_KEY                  # API key for VR_Client_API authorization
SITE_ID                  # MongoDB site document ID
BUCKET_NAME              # S3 bucket name for this group (e.g., vivreal-dougskitchen)
CDN_BASE_URL             # CDN base (default: https://media.vivreal.io)
SHOWS_ID                 # Collection group ID for shows/content
TEAMMEMBERS_ID           # Collection group ID for team members
```

All env vars are injected by the EventHandler during Amplify deployment — they are NOT stored in this repo.

---

## Key Patterns

### All Branding is Data-Driven

- **Colors**: Come from `siteData` (primary, secondary, surface, etc.) — injected as CSS variables at runtime via `Providers`
- **Logo**: `getSignedUrl(siteData.logo)` — signed CloudFront URL from API
- **Site name**: From `siteData.businessInfo.name` or `siteData.name`
- **Social links**: From `siteData.socialLinks[]`
- **Contact email**: From `siteData.businessInfo.contactInfo.email`

No hardcoded brand names, colors, or logos anywhere in the template.

### Server Components First

Pages are async Server Components that fetch data and pass it to Client Components:
- `page.tsx` → fetches data → passes to `*Client.tsx`
- `Navbar.tsx` and `Footer` are also Server Components (they fetch nav data)

### Metadata is Dynamic

All `generateMetadata()` functions read from `getSiteData()` to build page titles, descriptions, and OG tags dynamically.

---

## Adding New Pages

1. Create route at `src/app/{page-name}/page.tsx`
2. Add navigation entry in `src/lib/api/navigation/index.tsx` DEFAULT_NAV array
3. The page can fetch any collection by its ID (passed via env var)

---

## Updating `@vivreal/site-renderer`

The shared rendering package is installed from GitHub. After changes are pushed to `vivreal-site-renderer` master:

```bash
# 1. Remove the old copy + Next.js cache
rm -rf .next node_modules/@vivreal/site-renderer

# 2. Reinstall from GitHub (--install-links avoids symlinks that break Turbopack)
npm install "github:HillBombCreations/vivreal-site-renderer#master" --install-links

# 3. Restart dev server
npm run dev
```

**Why `--install-links`?** Without it, npm creates a symlink for git-based deps. Turbopack cannot resolve modules through symlinks, so the build fails with "Can't resolve '@vivreal/site-renderer'". The `--install-links` flag forces a real copy.

**Why clear `.next`?** Turbopack caches compiled modules aggressively. If you update the renderer and the changes don't appear, clearing `.next` forces a full recompile.

---

## Template Branch Model

- Each branch in `Vivreal_Templates` = one template type
- Branches: `main` (landing), `ecommerce-v2`, `showcase` (this one)
- User site branches are auto-created by EventHandler off template branches
- GitHub Actions sync workflow merges template changes to all user site branches
- **Never commit client-specific content** — everything must be data-driven
