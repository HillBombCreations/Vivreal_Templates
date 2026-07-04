import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import { getSiteData, getPageLabel } from "@/lib/api/siteData";
import { resolveSiteOrigin, buildOgImageUrl } from "@/lib/og/ogImage";
import { getPageBySlug } from "@/lib/pages";
// CC8 Phase 4: FormClient is no longer routed (form pages compose through the
// renderer FormLayout/ConfigurableForm via composePage). Import removed; the
// component file is retained until it is retired post-dogfood validation.
// SP-6: SubscribeClient now injected via composePage components override.
// SP-6: this file no longer imports getPageData/ContentRenderer/PageShell/MenuPage/
// getCollectionItems (the legacy arms that used them were migrated to composePage).
// Those module files still exist (used elsewhere or pending Task 9 deletion) but are
// no longer referenced HERE.
import SubscribeClientAdapter from "@/components/PageTemplates/SubscribeClientAdapter";
import { renderComposedPage } from "@/lib/renderComposedPage";
import { composePage } from "@hillbombcreations/site-renderer";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import ProductsPageComposed from "@/components/PageTemplates/ProductsPageComposed";
import CoordinatedProductsComposed from "@/components/PageTemplates/CoordinatedProductsComposed";
import CoordinatedScheduleComposed from "@/components/PageTemplates/CoordinatedScheduleComposed";
import type { PageConfig } from "@/types/SiteData";
// S2/OD#3 — schedule view type for ?view= param validation.
import type { ScheduleView } from "@hillbombcreations/site-renderer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Formats migrated to the unified composePage() pipeline (Plan 4). Migrated one
// at a time, parity-gated; any format NOT listed here keeps the legacy per-format
// JSX below. The live site and the Studio preview both render listed formats
// through the same composePage(), so they can no longer drift.
//
// SP-6 additions:
//   "menu"      — Task 2: composePage reads buildMenuSections (legacy fallback)
//                 or the menu page-template block (blocks-first). CTA: rendered only
//                 when page.cta exists (legacy default-on band dropped — 0 live pages).
//   "subscribe" — Task 3: composePage with synthesized subscribe block + injected
//                 SubscribeClientAdapter. buildSections dispatch returns [] for
//                 subscribe (by design), so the block path is MANDATORY.
//   "standard"  — Task 5 (OQ-3 decision a): add known generic format strings
//                 incrementally. 0 live generic pages today (DB verified 2026-06-21).
//                 Fall-through to buildGenericSections (legacy) or block path.
//
// NOTE: "subscribers" is NOT added here — it must remain unreachable as a route.
// Task 5 adds an explicit notFound() guard before the composePage render to
// enforce this even after Task 8 gives the synthetic page a subscribe block.
const COMPOSE_FORMATS = new Set<string>([
  "static",
  // Batch 4 (item 12b) — the block-composed About page type. Falls through to the
  // generic `else` branch below (pageConfig pass-through) → composePage renders its
  // section-header + about blocks via mapBlocks. Without this entry an About page
  // (format:'about') is not a recognized route and 404s (the /about-us regression).
  "about",
  "shows",
  "team",
  "checkout-success",
  "checkout-cancel",
  "products",
  "schedule",
  // CC8 Phase 4: route form/review pages through composePage → renderer
  // FormLayout/ConfigurableForm so live == Studio preview (WYSIWYG). The
  // renderer reads the section's submitMode/collectionId + rating config to
  // render review-mode (rating input + POST to /api/review). A form page with
  // no submitMode (no CC8 backfill yet) composes to the legacy contact form
  // (email path) — graceful degradation, not a crash. See FormClient (retired).
  "form",
  // SP-6 Task 2 — menu arm migration
  "menu",
  // SP-6 Task 3 — subscribe arm migration
  "subscribe",
  // SP-6 Task 5 — generic arm migration (OQ-3 decision a: incremental allowlist)
  "standard",
  "list",
  "grid",
]);
function composeFormat(format: string | undefined): format is string {
  return format !== undefined && COMPOSE_FORMATS.has(format);
}

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  // Privacy and terms always render on every site, even if not in page config
  const STATIC_SLUGS: Record<string, string> = {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  };
  if (!pageConfig && !STATIC_SLUGS[slug]) return notFound();

  const format = pageConfig?.format ?? (STATIC_SLUGS[slug] ? "static" : undefined);
  const name = pageConfig?.name ?? STATIC_SLUGS[slug] ?? slug;

  // OQ-5 guard (SP-6 Task 5, reviewer Concern #2): the VR_Client_API synthetic
  // "subscribers" page must never be a navigable route — it exists solely so
  // EmailPopup can find the subscribers collection ID. Once Task 8 gives the
  // synthetic page a subscribe block, the blocks-first path in buildSections
  // short-circuits on blocks.length>0 and would render the subscribe form at
  // /subscribers instead of 404ing. The explicit guard here keeps /subscribers
  // unreachable as a route regardless of what the synthetic page carries, and
  // prevents future regressions if "subscribers" is accidentally added to
  // COMPOSE_FORMATS or the dispatch fall-through is restructured.
  if (format === "subscribers") return notFound();

  // Composed formats (Plan 4 + SP-6) — render through the same composePage() the
  // Studio preview uses. Handled first so static can render with pageConfig undefined
  // (privacy/terms always exist even without a portal page config).
  if (composeFormat(format)) {

    let composedPage: PageConfig;
    if (format === "static") {
      // Static (privacy/terms): resolve labels via getPageLabel exactly as the
      // legacy StaticPage did, and synthesize a config for the slug-only
      // privacy/terms pages that have no portal page config. composePage's static
      // branch keys default copy off page.slug and emits the trailing CTA band.
      const labels: Record<string, string> = {
        title: getPageLabel(siteData, name, "title", name),
        content: getPageLabel(siteData, name, "content", ""),
      };
      composedPage = pageConfig
        ? { ...pageConfig, labels }
        : { name, slug, format, collectionId: null, labels };
      // Delegate to the shared helper so [slug] and [slug]/[itemId] cannot drift.
      return renderComposedPage({ siteData, composedPage });
    } else if (format === "subscribe") {
      // SP-6 Task 3 — subscribe arm migration.
      //
      // buildSections dispatch returns [] for format:'subscribe' by design
      // (the consumer owns the form injection). The block path is MANDATORY here:
      // we must ensure composedPage carries a subscribe page-template block so
      // mapBlocks routes through the SubscribePage mapper (blocks.ts:286).
      //
      // Additive superset: if the page already has a subscribe block (authored or
      // SP-3-backfilled), pass it through unchanged. If not (legacy collectionId
      // path), synthesize a one-block composedPage — same pattern as the static
      // synthesis above. SP-7 will $unset collectionId after this migration lands.
      const hasSubscribeBlock = (pageConfig?.blocks ?? []).some(
        (b) => b?.type?.kind === "page-template" && b?.type?.dispatchId === "subscribe",
      );
      if (!hasSubscribeBlock) {
        // Resolve the collection id via the legacy fields (additive: these still
        // exist until SP-7 $unsets them; the block binding is the SP-6+ path).
        const legacyCollectionId =
          pageConfig?.collectionId ?? pageConfig?.collections?.[0]?.collectionId ?? "";
        composedPage = {
          ...(pageConfig ?? { name, slug, format, collectionId: null, labels: {} }),
          blocks: [
            {
              id: `subscribe-synthesized-0`,
              type: { kind: "page-template" as const, dispatchId: "subscribe" },
              order: 0,
              enabled: true,
              config: {
                bindings: [
                  { collectionId: legacyCollectionId || undefined, role: "primary" as const },
                ],
              },
            },
          ],
        };
      } else {
        composedPage = pageConfig!;
      }
    } else if (format === "checkout-success" || format === "checkout-cancel") {
      // Checkout result pages (Items 4/6 fix).
      //
      // buildSections delegates unconditionally to mapBlocks (ph.6). The
      // checkout-status page-template block produces the CheckoutSection that
      // CheckoutResultTemplate renders. Existing production pages were seeded with
      // checkout-status blocks in the Phase-B backfill before GATE-1, so they
      // already carry one and we pass them through unchanged.
      //
      // A freshly-created checkout page has NO checkout-status block, so mapBlocks
      // produces [] and the page renders empty. Fix: synthesize a checkout-status
      // block at READ TIME when none exists, populating config.labels from the page's
      // authored page.labels (heading/body/buttonLabel). This is the same additive-
      // superset pattern used by the subscribe arm above — no migration needed.
      //
      // Guard: only synthesize when no checkout-status block is already stored.
      // When one exists (seeded pages + any future authored blocks), pass the page
      // through unchanged but ensure its config.labels reflect the current page.labels
      // so a user's copy edits in CheckoutLabelsEditor are visible immediately.
      const existingBlock = (pageConfig?.blocks ?? []).find(
        (b) => b?.type?.kind === "page-template" && b?.type?.dispatchId === "checkout-status",
      );
      if (!existingBlock) {
        // No stored checkout-status block — synthesize one from page.labels.
        const pageLabels = pageConfig?.labels ?? {};
        composedPage = {
          ...(pageConfig ?? { name, slug, format, collectionId: null, labels: {} }),
          blocks: [
            {
              id: "checkout-status-synthesized-0",
              type: { kind: "page-template" as const, dispatchId: "checkout-status" },
              order: 0,
              enabled: true,
              config: {
                labels: {
                  success: format === "checkout-success",
                  heading: pageLabels.heading ?? "",
                  body: pageLabels.body ?? "",
                  buttonLabel: pageLabels.buttonLabel ?? "",
                },
              },
            },
          ],
        };
      } else {
        // Stored checkout-status block exists. Overlay its config.labels with the
        // current page.labels so copy edits from CheckoutLabelsEditor are reflected
        // without requiring a separate block-level save. The block id/order are
        // preserved; this overlay is read-only (never persisted).
        const pageLabels = pageConfig!.labels ?? {};
        const patchedBlock: typeof existingBlock = {
          ...existingBlock,
          config: {
            ...existingBlock.config,
            labels: {
              ...((existingBlock.config?.labels as Record<string, unknown>) ?? {}),
              success: format === "checkout-success",
              heading: pageLabels.heading ?? (existingBlock.config?.labels as Record<string, unknown>)?.heading ?? "",
              body: pageLabels.body ?? (existingBlock.config?.labels as Record<string, unknown>)?.body ?? "",
              buttonLabel: pageLabels.buttonLabel ?? (existingBlock.config?.labels as Record<string, unknown>)?.buttonLabel ?? "",
            },
          },
        };
        composedPage = {
          ...pageConfig!,
          blocks: (pageConfig!.blocks ?? []).map((b) =>
            b === existingBlock ? patchedBlock : b,
          ),
        };
      }
    } else {
      // All other composed formats (shows, team, products, menu, schedule, form,
      // generic) always have a portal page config (reached before the !pageConfig
      // notFound guard below). Pass through — composePage owns their label
      // defaults + shaping.
      //
      // menu: buildMenuSections is the dispatch fallback (legacy collections)
      //   OR the menu page-template block (blocks-first, post-SP-3). CTA note:
      //   buildMenuSections appends maybeCtaSection, which renders ONLY when page.cta
      //   exists/enabled. The legacy arm rendered a default-on CTA band even without a
      //   cta field — so a cta-less menu page loses that default band. Accepted: 0 live
      //   menu pages, and an empty default CTA pointing nowhere is low value.
      // generic (standard/list/grid): buildGenericSections is the dispatch fallback
      //   OR layout/collection blocks (blocks-first, post-SP-3). Sidebar drops for
      //   free — buildGenericSections flattens it into the linear body (D-B audit:
      //   0 sidebar-role bindings on any live page; safe to drop the two-column mode).
      composedPage = pageConfig!;
      // CP-11: Delegate generic composed formats (about/standard/list/grid) to the
      // shared helper so [slug]/page.tsx and [slug]/[itemId]/page.tsx cannot drift.
      // Shows/team/products/schedule/form/menu remain in the code path below.
      if (
        format === "about" ||
        format === "standard" ||
        format === "list" ||
        format === "grid"
      ) {
        return renderComposedPage({ siteData, composedPage });
      }
    }

    // Products controlled query: parse f_<key>/search/sort from the URL so the
    // builder filters server-side (VR_Client_API), and inject the live,
    // router+cart-wired ProductsPage via the B1 component override. composePage
    // renders the bare uncontrolled ProductsPage for the Studio preview.
    let productQuery:
      | { filters?: Record<string, string>; search?: string; sort?: string }
      | undefined;
    // Components override: ProductsPage (B1) + SubscribePage (SP-6 Task 3)
    // + CoordinatedSchedule (S2).
    // Formats are mutually exclusive so at most one override set fires per render.
    // `as any` on the type is required for CoordinatedSchedule: the key is defined
    // in the renderer working tree but not yet in the installed 1.17.0 package's
    // CompositionComponentOverrides. Remove the cast when the package is bumped.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let components: any;

    // S2/OD#3 — schedule active view from `?view=` searchParam.
    // Validated against the three legal values (agenda|month|map); any other
    // value is dropped (undefined → provider uses pageConfig.defaultView).
    // Only parsed for schedule format to avoid touching other routes.
    let scheduleView: ScheduleView | undefined;

    if (format === "products") {
      const sp = (await searchParams) ?? {};
      const filters: Record<string, string> = {};
      for (const [key, val] of Object.entries(sp)) {
        if (key.startsWith("f_") && typeof val === "string" && val) {
          filters[key.slice(2)] = val;
        }
      }
      productQuery = {
        filters,
        search: typeof sp.search === "string" ? sp.search : undefined,
        sort: typeof sp.sort === "string" ? sp.sort : undefined,
      };
      // Wire BOTH products topologies live (G4 part ①): the monolith
      // page-template via ProductsPage, AND the atomized
      // group(coordinated:'products') via CoordinatedProducts. A products page
      // renders through exactly one arm depending on whether its blocks contain
      // the coordinated group — both overrides set, only one fires. The Studio
      // preview (which never passes these overrides) stays bare/uncontrolled.
      components = {
        ProductsPage: ProductsPageComposed,
        CoordinatedProducts: CoordinatedProductsComposed,
      };
    } else if (format === "schedule") {
      // S2/OD#3: wire the coordinated schedule override (URL-sync + initialView).
      // The monolith page-template arm (SchedulePage, via renderPageTemplate) also
      // exists for legacy non-atomized schedule pages — the `CoordinatedSchedule`
      // override fires ONLY when the page carries a group(coordinated:'schedule').
      // Both can be set; only one arm fires per render depending on the page topology.
      const sp = (await searchParams) ?? {};
      const viewParam = typeof sp.view === "string" ? sp.view : undefined;
      // Validate against the three legal values — drop anything else.
      if (viewParam === "agenda" || viewParam === "month" || viewParam === "map") {
        scheduleView = viewParam;
      }
      components = {
        CoordinatedSchedule: CoordinatedScheduleComposed,
      };
    } else if (format === "subscribe") {
      // SP-6 Task 3: inject the live SubscribeClient (form + API wiring) via the
      // SubscribeClientAdapter (which bridges the labels type narrowing). composePage
      // passes CollectionId + labels from the shaped subscribe payload to the adapter.
      components = { SubscribePage: SubscribeClientAdapter };
    }

    const { input, isEmpty } = await buildPageContext({
      siteData,
      page: composedPage,
      isHome: false,
      productQuery,
    });

    // SP-6 Task 5 (OQ-5 complement): generic-format empty pages → notFound().
    // Mirrors the legacy guard at the old generic arm (:243). Only applies to
    // formats that fall through to buildGenericSections (not static/checkout/shows
    // etc — those have non-empty content by definition or their own empty handling).
    // buildPageContext.isEmpty already excludes static/checkout-success/checkout-cancel.
    if (isEmpty && (format === "standard" || format === "list" || format === "grid")) {
      return notFound();
    }

    // SP-6 Task 5 — Concern-3 transitional title band (B-wrapper fallback).
    //
    // buildGenericSections emits flat layout sections but NO page-level title band
    // (the legacy PageShell provided it). Per the epic model (B-author), the SP-3
    // backfill will emit a leading Section Header block that composePage renders
    // as the title — but until a generic page is backfilled, the title would
    // vanish. This guard self-disables once the page has a section-header block:
    //
    //   - Show the fallback band ONLY when:
    //       (a) the format is generic (standard/list/grid)
    //       (b) the page has a labels.title
    //       (c) the page's blocks[] does NOT already lead with a section-header
    //
    // Any section-header block anywhere in blocks[] (not just leading) suppresses
    // the fallback, because post-backfill the block owns the heading role.
    const isGenericFormat = format === "standard" || format === "list" || format === "grid";
    const hasLabelTitle = !!(composedPage.labels?.title);
    const hasSectionHeaderBlock = (composedPage.blocks ?? []).some(
      // A Section Header block has type.kind:'static' + type.dispatchId:'section-header'
      // (renderer registry.js:152, defaultBlocks.js:100). 'section-header' is a
      // dispatchId, NOT a BlockKind — so match on dispatchId. Matching kind here would
      // never fire → double-title once SP-3 backfills the leading Section Header.
      (b) => b?.type?.dispatchId === "section-header",
    );
    const showTransitionalTitleBand = isGenericFormat && hasLabelTitle && !hasSectionHeaderBlock;

    return (
      <>
        <Navbar />
        {showTransitionalTitleBand && (
          // Transitional title band: renders the legacy page.labels.title/subtitle
          // so generic pages that haven't been SP-3-backfilled still show their H1.
          // Self-disables once the page carries a section-header block (B-author model).
          // Matches the PageShell header styling (content-grid pt-28 pb-0).
          <div className="content-grid pt-28 pb-0">
            <header className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {composedPage.labels.title}
              </h1>
              {composedPage.labels.subtitle && (
                <p className="mt-2 text-lg text-muted-foreground">
                  {composedPage.labels.subtitle}
                </p>
              )}
            </header>
          </div>
        )}
        {composePage(
          components || scheduleView
            ? {
                ...input,
                options: {
                  ...input.options!,
                  ...(components ? { components } : {}),
                  // S2/OD#3: thread the validated ?view= param so the coordinated
                  // schedule arm can pass it as `initialView` to the override.
                  // Cast required: `scheduleView` is added to CompositionOptions in
                  // the renderer working tree but not yet in the installed 1.17.0
                  // package. This cast is removed when the package is bumped.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ...(scheduleView ? { scheduleView } as any : {}),
                },
              }
            : input,
        )}
        <Footer />
      </>
    );
  }

  // Beyond this point pageConfig is always defined (non-static formats require a page config).
  // SP-6: menu/subscribe/standard/list/grid are now in COMPOSE_FORMATS and handled above.
  if (!pageConfig) return notFound();

  // CC8 Phase 4: form/review pages are now composed (see COMPOSE_FORMATS +
  // the composeFormat() block above). The legacy <FormClient> branch is removed
  // from the routing path here; FormClient itself is retired in a SEPARATE
  // commit after dogfood validation (publish-gate phasing). No fallback cycle.

  // All formats handled by COMPOSE_FORMATS or the detail route below.
  // Any format that reaches this point falls through to notFound().
  return notFound();
}

const STATIC_PAGE_TITLES: Record<string, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";

  if (!pageConfig && !STATIC_PAGE_TITLES[slug]) {
    return { title: `Not Found | ${siteName}` };
  }

  // Studio-authored SEO overrides take precedence over the label/name-derived
  // defaults. `metaTitle` is the exact title (author owns the full string, so it
  // is NOT suffixed with the site name); the derived title keeps the "| site"
  // suffix for a sensible default.
  const seo = pageConfig?.seo;
  const derivedTitle =
    pageConfig?.labels?.title || pageConfig?.name || STATIC_PAGE_TITLES[slug] || slug;
  const title = seo?.metaTitle || `${derivedTitle} | ${siteName}`;
  const description =
    seo?.metaDescription ||
    pageConfig?.labels?.subtitle ||
    `${derivedTitle} — ${siteName}`;

  const origin = resolveSiteOrigin(siteData);
  const ogImageUrl = buildOgImageUrl(origin, slug);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${origin}/${slug}`,
      type: "website",
      siteName,
      images: [ogImageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
