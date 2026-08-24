import { notFound, permanentRedirect } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import { CTASectionTemplate } from "@/components/RendererExports";
import { DetailPageTemplate } from "@hillbombcreations/site-renderer";
import type { SiteData as RendererSiteData } from "@hillbombcreations/site-renderer";
import { getSiteData, getPageCollectionId } from "@/lib/api/siteData";
import { resolveMissingItemRedirect } from "@/lib/redirects";
import type { SiteData } from "@/types/SiteData";
import { resolveSiteOrigin, buildOgImageUrl, buildDetailUrl } from "@/lib/og/ogImage";
import { getPageBySlug } from "@/lib/pages";
import { getShowById } from "@/lib/api/shows";
import { getTeamMembers } from "@/lib/api/team";
import { getTikTokPosts, getTikTokOEmbed } from "@/lib/api/social";
import { getProductById } from "@/lib/api/products";
import { collectBindingTargets } from "@/lib/api/composition/bindings";
import { isPaymentsProvider } from "@/lib/payments";
import { getIntegrationItems, getCollectionItems } from "@/lib/api/collections";
import { renderComposedPage } from "@/lib/renderComposedPage";
import { LIVE_PRODUCTS_OVERRIDES } from "@/components/PageTemplates/liveProductsOverrides";
import { parseProductQuery } from "@/lib/composition/productQuery";
import ProductDetailRenderer from "@/components/PageTemplates/ProductDetailRenderer";
import ContentRenderer from "@/components/ContentRenderer";
import type {
  DetailItem,
  DetailPageConfig,
  DetailSection,
  PageCtaConfig as RendererPageCtaConfig,
} from "@hillbombcreations/site-renderer";
import { JsonLd, buildDetailJsonLd } from "@/components/JsonLd";
import { unsignMediaUrl } from "@/components/JsonLd/unsignMediaUrl";
import { applyScope, itemSegment, resolvePattern } from "@hillbombcreations/site-renderer";
import { resolveItem, isDoorwayMiss } from "@/lib/detail/resolveItem";
import { resolveDetailContext } from "@/lib/detail/resolveContext";
import { applyContextOverrides } from "@/lib/detail/contextOverlay";
import { resolveDetailCanonical } from "@/lib/detail/canonical";
import { buildRouteCanonicalMetadata } from "@/lib/seo/routeMetadata";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/**
 * docs/bugs/templates-soft-404-and-301-status, Change A (Open Question 2
 * re-ruling) — the shared missing-item resolver every named-format arm below
 * calls on ITS OWN "item not found" branch.
 *
 * Fixes the deep-redirect unreachability the plan's §Change 1a documented:
 * each arm used to answer "does this item exist?" and call `notFound()`
 * inline, so the bottom-of-function redirect fallback (the WS3 mechanism at
 * the end of this component) was reachable only when `pageConfig.format`
 * matched NO arm — a 2-segment authored redirect whose `from` sits under a
 * live page slug (e.g. `/shop/retired-sku` where `shop` is a live `products`
 * page) hard-404'd and the authored redirect never fired. This reorders the
 * question: on a missing item, resolve an authored redirect for the request
 * path FIRST; fall back to `notFound()` only when there is none (or the
 * authored `to` fails the same-origin guard).
 *
 * NEVER SHADOW LIVE CONTENT: this function's only callers are each format
 * arm's OWN "can't serve a real item here" branch — never the success path,
 * so an existing item can never be redirected. Most callers are literally
 * `if (!item) return redirectOrNotFound(...)` (shows, team, the generic
 * collection-list item, the menu item), but two are not an item-missing
 * check at all: the `!collectionId` branch (no `itemCollectionId`/page
 * binding resolves to a collection) and the `!itemsCollectionId &&
 * siblingCollectionIds.length === 0` branch (a menu page with no items
 * binding at all) are the PAGE misconfigured, not any specific item
 * missing — no item could exist to shadow in either case, so the same
 * safety property holds, just for a different reason. Review note N3
 * (page-layer-unvalidated-redirect-target).
 * This is the same invariant `resolveRedirect()`'s doc comment
 * (`@/lib/redirects.ts`) documents for the pre-existing `!pageConfig` and
 * bottom-of-function redirect checks in this file; this helper extends it to
 * every named-format arm's missing-item (and misconfigured-page) path too.
 *
 * Status: `permanentRedirect()` emits 308, not 301 — middleware.ts
 * (`src/middleware.ts`) owns the literal-301 path for a redirect it can see;
 * this is the correct-destination fallback for the deep-redirect shape
 * middleware structurally cannot resolve (it cannot tell a retired item from
 * a live one without a per-request CMS read).
 *
 * All matching logic is reused, not reimplemented: `resolveMissingItemRedirect()`
 * (`@/lib/redirects`) composes the shared, pure `resolveRedirect()` with the
 * same-origin guard `isSameOriginRedirectTarget()` — the same guard
 * middleware.ts applies (there, followed by an additional authoritative
 * resolved-URL origin check this page layer has no request object to
 * perform; see that predicate's doc comment for why the pre-filter alone is
 * sufficient here). On a hostile `to` (`isSameOriginRedirectTarget` returns
 * false) this falls through to `notFound()`, never an off-origin redirect.
 */
function redirectOrNotFound(siteData: SiteData, path: string): never {
  const target = resolveMissingItemRedirect(siteData.redirects, path);
  if (target) permanentRedirect(target);
  return notFound();
}

interface Props {
  params: Promise<{ slug: string; itemId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DynamicItemPage({ params, searchParams }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  // CP-11: Resolve depth-2 nested sub-pages (e.g. /features/ai-sites) that the
  // migrator emits as pageConfig.slug="features/ai-sites". Next.js matches the
  // URL as [slug]="features" / [itemId]="ai-sites". Join the two segments and
  // check against pageConfigs BEFORE the single-segment !pageConfig guard.
  //
  // Disambiguation guarantee: collection items (blog posts, shows, products, team
  // members) are NEVER stored as pageConfigs, so getPageBySlug(siteData,
  // "blog/<post>") always returns undefined and the existing detail-item logic
  // below runs unchanged.
  const nestedSlug = `${slug}/${itemId}`;
  const nestedPage = getPageBySlug(siteData, nestedSlug);
  if (nestedPage) {
    // Defensive guard: formats needing runtime component overrides or their own
    // interactive arms never render via renderComposedPage. If one appears nested,
    // return notFound() rather than misrender. `menu` is deliberately NOT here:
    // a menu page composes with no overrides (ComposedFormatBody ≡ ComposedPageBody
    // for it), and migrated location-scoped menus ship 2-segment slugs like
    // "moraga/dinner" (Breweries template, Gate-2 2026-07-15).
    //
    // T6 (two-axis detail-route design §2.1/§8) — `team` REMOVED from this set.
    // The alchemy43 blueprint authors `slug: "about/providers", format: "team"`,
    // which this guard 404'd unconditionally (found while wiring the scoped-
    // detail arm above, not caused by it). `team` needs no live component
    // override (unlike `products`' CartAdapter) and already composes fine as a
    // TOP-LEVEL page via the identical `renderComposedPage` → mapPageTemplate
    // `'team'` dispatch (`[slug]/page.tsx`'s COMPOSE_FORMATS). The one real
    // constraint — a nested team page's OWN member detail links would need a
    // 3-segment route this file can't serve — degrades to today's existing
    // 404 on click (same as any unreachable 3-segment URL), not a misrender;
    // it does not block the roster PAGE itself from finally rendering.
    // `shows`/`products`/etc. are left untouched (no design-doc finding cites
    // them, and their detail arms carry real interactive/JSON-LD surface this
    // repo hasn't audited for the nested case).
    const NON_NESTABLE_FORMATS = new Set([
      "products", "schedule", "subscribe",
      "checkout-success", "checkout-cancel", "home", "shows",
    ]);
    if (NON_NESTABLE_FORMATS.has(nestedPage.format)) return notFound();
    // Same live storefront overrides + controlled query as [slug]/page.tsx's
    // generic arm — a nested sub-page can compose a storefront group too, and
    // without the overrides its grid renders the bare (CartAdapter-less) arm.
    const sp = (await searchParams) ?? {};
    return renderComposedPage({
      siteData,
      composedPage: nestedPage,
      components: LIVE_PRODUCTS_OVERRIDES,
      productQuery: parseProductQuery(sp),
    });
  }

  if (!pageConfig) {
    // Phase 0 of the two-axis detail-route design (§5.1, §7.2 step 10) — the
    // WS3 301 redirect mechanism. This is the MORE common redirect shape for
    // this route: a `from` deeper than 1 segment whose first segment was
    // never itself a page slug (e.g. a flattened `/classes/category/
    // baking-classes` — bug found while wiring this in: the nestedSlug check
    // above and the bottom-of-function fallthrough both require `pageConfig`
    // to already resolve, so a redirect check placed only at the end never
    // ran for this case). Checked BEFORE notFound() so it can never shadow a
    // real page/nested-page (both already returned above).
    //
    // docs/bugs/page-layer-unvalidated-redirect-target: resolved via
    // `resolveMissingItemRedirect()`, the same shared resolve+validate
    // helper `redirectOrNotFound()` below uses — not a hand-rolled
    // resolve+`permanentRedirect()`, so a hostile `to` 404s here too instead
    // of reaching `permanentRedirect()` unvalidated.
    const redirectTarget = resolveMissingItemRedirect(siteData.redirects, `/${slug}/${itemId}`);
    if (redirectTarget) permanentRedirect(redirectTarget);
    return notFound();
  }

  // Guard: if detail pages are explicitly disabled for this page, return 404
  if (pageConfig.detailPage?.enabled === false) return notFound();

  // Show/event detail
  if (pageConfig.format === "shows") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.SHOWS_ID || "");
    const show = await getShowById(itemId, collectionId);

    // Change B (docs/bugs/templates-soft-404-and-301-status): this arm used
    // to render a hand-rolled "Not found" page here at a soft status 200 —
    // the only arm in this file that did not call notFound() on a miss. Now
    // consistent with every other format: redirectOrNotFound() resolves an
    // authored redirect first, else notFound() (a real 404 via
    // src/app/not-found.tsx, same as every other arm below).
    if (!show) return redirectOrNotFound(siteData, `/${slug}/${itemId}`);

    const showStartDate =
      show.date && show.time
        ? `${show.date}T${show.time}`
        : show.date || undefined;
    const showJsonLd = buildDetailJsonLd({
      format: 'shows',
      title: show.title,
      description: show.description?.replace(/<[^>]*>/g, '').slice(0, 500),
      // Strip CloudFront signing params before embedding in long-lived JSON-LD
      // (crawler caches outlive the 300s signed-URL TTL) — same treatment the
      // team branch already applies to member images.
      imageUrl: unsignMediaUrl(show.imageUrl || show.image || undefined),
      url: buildDetailUrl(siteData, slug, itemId),
      startDate: showStartDate,
      location: show.location || undefined,
    });

    return (
      <>
        <JsonLd schema={showJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format="shows"
          item={show as unknown as DetailItem}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={pageConfig.detailPage as DetailPageConfig | undefined}
        />
        <Footer />
      </>
    );
  }

  // Team member detail
  if (pageConfig.format === "team") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.TEAMMEMBERS_ID || "");
    const teamMembers = await getTeamMembers(collectionId);
    const member = teamMembers.find((m) => m.id === itemId);

    if (!member) return redirectOrNotFound(siteData, `/${slug}/${itemId}`);

    // Fetch TikTok posts and match by handle
    const tiktokHandle = member.socialLinks?.tiktok;
    let tiktokEmbeds: { caption: string; permalink: string; html: string | null }[] = [];

    if (tiktokHandle) {
      const allPosts = await getTikTokPosts();
      const handle = tiktokHandle.replace(/^@/, "");
      const memberPosts = allPosts.filter(
        (p) => p.permalink && p.permalink.includes(handle)
      );

      tiktokEmbeds = await Promise.all(
        memberPosts.slice(0, 6).map(async (post) => ({
          caption: post.caption,
          permalink: post.permalink!,
          html: post.permalink
            ? ((await getTikTokOEmbed(post.permalink))?.html ?? null)
            : null,
        }))
      );
    }

    // Strip CloudFront signing params before embedding in JSON-LD; signed
    // URLs expire after 300s but JSON-LD lives in crawler caches for days.
    // See @/components/JsonLd/unsignMediaUrl.ts for the full rationale.
    const memberImage = unsignMediaUrl(member.imageUrl || member.image || undefined);
    const detailUrl = buildDetailUrl(siteData, slug, itemId);
    const memberJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: member.name,
      ...(member.description
        ? { description: member.description.replace(/<[^>]*>/g, '').slice(0, 500) }
        : {}),
      ...(memberImage ? { image: memberImage } : {}),
      ...(detailUrl
        ? { url: detailUrl }
        : {}),
      ...(siteData.businessInfo?.name
        ? {
            worksFor: {
              '@type': 'Organization',
              name: siteData.businessInfo.name,
            },
          }
        : {}),
    };

    return (
      <>
        <JsonLd schema={memberJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format="team"
          item={member as unknown as DetailItem}
          socialEmbeds={tiktokEmbeds}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={pageConfig.detailPage as DetailPageConfig | undefined}
        />
        <Footer />
      </>
    );
  }

  // Product detail — fires for format:'products' pages AND for any page whose
  // bindings (at any depth, incl. coordinated-group children) name a payments
  // provider: a storefront group is composable on ANY page (universal page
  // model), and its tiles link here. First live Square E2E: the catalog-format
  // Shop page's Square PDPs 404'd because this arm was format-gated.
  //
  // Provider resolution reuses the composition collector rather than
  // re-walking the shapes; no payments binding (products format only) ⇒
  // undefined ⇒ getProducts' legacy stripe default.
  const { integrationTypes } = collectBindingTargets(pageConfig);
  const paymentsProvider = integrationTypes.find((t) => isPaymentsProvider(t));
  const product =
    pageConfig.format === "products" || paymentsProvider
      ? await getProductById(itemId, paymentsProvider ?? "stripe")
      : null;
  // A products page has no other arm that could serve this id → 404 on a miss
  // (unchanged). Non-products pages can carry BOTH a storefront and plain
  // collection tiles that link to /<slug>/<itemId> — a product miss there
  // falls through to the collection/menu arms below instead.
  if (!product && pageConfig.format === "products")
    return redirectOrNotFound(siteData, `/${slug}/${itemId}`);
  if (product) {
    // Fetch supplemental integrations for the detail page (non-payments ones —
    // the page's payments binding must not double-render as a supplemental feed)
    const detailIntegrations = (pageConfig.detailPage?.integrations ?? [])
      .filter(i => !isPaymentsProvider(i.type ?? i.name));

    const detailSupplemental = await Promise.all(
      detailIntegrations.map(async (binding) => {
        const type = (binding.type ?? binding.name ?? '').toLowerCase();
        const { items } = await getIntegrationItems(type, { limit: 10 });
        return { items, displayAs: binding.displayAs ?? 'feed', type };
      })
    );

    // Product JSON-LD: only emit Product schema when name/price/image are
    // plain strings (not variant maps) — otherwise we'd need to pick a
    // default variant, which is a renderer-level concern. Fall back to
    // the generic detail JSON-LD (Thing) when variant-keyed.
    const productName =
      typeof product.name === 'string' ? product.name : undefined;
    const productPrice =
      typeof product.price === 'string' ? product.price : undefined;
    const productImage =
      typeof product.imageUrl === 'string' ? product.imageUrl : undefined;
    const productDescription =
      typeof product.description === 'string'
        ? product.description.replace(/<[^>]*>/g, '').slice(0, 500)
        : undefined;

    const productJsonLd = buildDetailJsonLd({
      format: 'products',
      title: productName || 'Product',
      description: productDescription,
      imageUrl: productImage,
      url: buildDetailUrl(siteData, slug, itemId),
      price: productPrice,
      sku: product._id,
    });

    // Build the renderer detail config. The route already renders supplemental
    // integrations + CTA in its own blocks below, so scope the renderer's
    // sections to the buy box (hero/variants/addToCart/content) to avoid
    // double-rendering. Honor any explicitly-configured sections by filtering
    // out the route-owned ones.
    const ROUTE_OWNED_SECTIONS = new Set<DetailSection>([
      "supplementalIntegrations",
      "related",
      "cta",
    ]);
    // The runtime `detailPage` may carry v0.4.0 fields (sections, heroVariant,
    // etc.) the Templates `PageConfig` type doesn't declare — view it through
    // the renderer's config type to read them safely.
    const existingDetailPage = pageConfig.detailPage as DetailPageConfig | undefined;
    const configuredSections = existingDetailPage?.sections;
    const buyBoxSections: DetailSection[] = (configuredSections ?? [
      "hero",
      "variants",
      "addToCart",
      "content",
    ]).filter((s) => !ROUTE_OWNED_SECTIONS.has(s));

    const rendererDetailPage: DetailPageConfig = {
      ...existingDetailPage,
      sections: buyBoxSections,
    };

    return (
      <>
        <JsonLd schema={productJsonLd} />
        <Navbar />
        <ProductDetailRenderer
          product={product}
          siteData={siteData}
          slug={slug}
          detailPage={rendererDetailPage}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
        />
        {detailSupplemental.length > 0 && (
          <div className="content-grid py-8">
            {detailSupplemental.map((section, i) => (
              <div key={i} className="mb-8">
                <h3 className="text-lg font-semibold mb-4 capitalize" style={{ color: 'var(--text-primary)' }}>
                  {section.type}
                </h3>
                <ContentRenderer
                  items={section.items}
                  displayAs={section.displayAs}
                  slug={slug}
                />
              </div>
            ))}
          </div>
        )}
        <CTASectionTemplate siteData={siteData as unknown as RendererSiteData} />
        <Footer />
      </>
    );
  }

  // Generic CMS collection-list item detail (products, menu/catalog entries, etc.)
  // — GENERALIZED into the two-axis detail-route design's scoped-detail arm
  // (§7.2 steps 4-9, T1). A collection-list grid links each card to
  // /<slug>/<mongoId>; without this arm every such click falls through to
  // notFound() below (there is no products/shows/team format match for a
  // plain CMS collection). ALSO fires for any page carrying
  // `detailPage.itemCollectionId` regardless of format — this is what lets a
  // `location-hub` page (§15.5 — no new semantic-marker format) host a
  // scoped detail route: "a page that scopes a collection also hosts detail
  // routes for the items in that scope, rendered in that page's context."
  const scopedDetailPage = pageConfig.detailPage;
  if (pageConfig.format === "collection-list" || scopedDetailPage?.itemCollectionId) {
    const collectionId =
      scopedDetailPage?.itemCollectionId || getPageCollectionId(siteData, pageConfig.name, "");
    if (!collectionId) return redirectOrNotFound(siteData, `/${slug}/${itemId}`);

    // limit 100 mirrors the grid's own fetch (buildPageContext.ts) — the Client
    // API 502s on larger limits, and the list view already caps at 100.
    const { items: unscopedItems } = await getCollectionItems(collectionId, { limit: 100 });

    // §7.2 step 5 — `scope` restricts WHICH ITEMS ARE ADDRESSABLE here.
    // Absent/malformed scope ⇒ identity (applyScope's own contract), so an
    // unscoped collection-list page is byte-identical to before.
    const scopedItems = applyScope(unscopedItems, scopedDetailPage?.scope);

    // §7.2 step 6 — `_id` tried FIRST unconditionally (no existing URL can
    // change meaning), then `raw[itemKeyField]` when configured.
    const itemKeyField = scopedDetailPage?.itemKeyField;
    const item = resolveItem(scopedItems, itemId, itemKeyField);

    if (!item) {
      // §7.2 step 7 — the doorway-page guard: an item that exists in the
      // UNSCOPED pool but was excluded by `scope` is a hard 404, never a
      // FALLBACK redirect to the unscoped page (that would invite crawling
      // the full cross-product — the 20 non-existent alchemy43 cells, §3).
      // Logged so a scope-exclusion 404 is distinguishable from a genuine
      // miss. Unrelated to (and not weakened by) redirectOrNotFound() below:
      // that only resolves an AUTHORED entry in siteData.redirects for this
      // exact path, never a derived fallback to the unscoped page.
      if (isDoorwayMiss(unscopedItems, itemId, itemKeyField)) {
        console.warn(
          `[detail-route] doorway-page guard: "${itemId}" exists in collection ${collectionId} but is excluded by page "${slug}"'s scope`,
        );
      }
      return redirectOrNotFound(siteData, `/${slug}/${itemId}`);
    }

    // §7.2 step 8 — resolve ONE context object (e.g. the location this page
    // is scoped to). Unresolvable ⇒ undefined; render without context
    // rather than 404 (a broken join must degrade, not delete a page).
    const contextRaw = await resolveDetailContext(scopedDetailPage?.context);
    // §7.2 step 9 — overlay `context.overrides` (itemField ← contextField)
    // onto a CLONE of the item. Most-specific-wins; absent context/overrides
    // ⇒ the item is returned untouched.
    const effectiveItem = applyContextOverrides(item, contextRaw, scopedDetailPage?.context?.overrides);

    const cleanDesc =
      typeof effectiveItem.description === "string"
        ? effectiveItem.description.replace(/<[^>]*>/g, "").slice(0, 500)
        : undefined;
    const itemJsonLd = buildDetailJsonLd({
      format: "products",
      title: effectiveItem.title || pageConfig.name,
      description: cleanDesc,
      // Strip CloudFront signing params before embedding in long-lived JSON-LD
      // (crawler caches outlive the 300s signed-URL TTL) — same treatment the
      // shows/team branches apply to their media.
      imageUrl: unsignMediaUrl(effectiveItem.imageUrl),
      url: buildDetailUrl(siteData, slug, itemId),
      price: typeof effectiveItem.price === "string" ? effectiveItem.price : undefined,
      sku: effectiveItem.id,
    });

    return (
      <>
        <JsonLd schema={itemJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format={pageConfig.format}
          item={effectiveItem as unknown as DetailItem}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={scopedDetailPage as DetailPageConfig | undefined}
          context={contextRaw}
        />
        <Footer />
      </>
    );
  }

  // Menu item detail (Levain PDP round — bakery page-by-page gate). Gate
  // matches the H1 doctrine the renderer's tile links follow: absent/null
  // detailPage means detail-ON; only an explicit enabled:false 404s. (The
  // route existing at all is new — fleet menu tiles only started LINKING here
  // with the same renderer bump, so defaults stay coherent.) A menu page
  // carries TWO bindings (categories + items) — resolve the ITEMS one by
  // menuRole, mirroring the renderer's blocks.ts fallbacks;
  // getPageCollectionId would blindly take the FIRST binding (categories).
  if (pageConfig.format === "menu") {
    // detailPage.enabled === false already 404'd at the top-of-function H1
    // gate — TS narrowing proves it can't recur here.
    const { itemsCollectionId, siblingCollectionIds } =
      resolveMenuDetailCollections(pageConfig);
    if (!itemsCollectionId && siblingCollectionIds.length === 0)
      return redirectOrNotFound(siteData, `/${slug}/${itemId}`);

    // The ITEMS binding is the primary pool; SIBLING bindings (the extra
    // collections a menu page carries around the pair — e.g. the bakery
    // catering page's cakes carousel, whose detail-eligible cards link here
    // too) are searched in binding order when the item isn't a menu item.
    // The pool the item came from feeds its related shelf.
    type PoolItem = Awaited<
      ReturnType<typeof getCollectionItems>
    >["items"][number];
    let pool: PoolItem[] = [];
    let item: PoolItem | undefined;
    // Two-axis detail-route design, Phase 1 (T2) — `_id` first unconditionally,
    // then `raw[itemKeyField]` when configured. Shared with the scoped-detail
    // arm above via `resolveItem` so both arms agree on lookup semantics.
    const menuItemKeyField = pageConfig.detailPage?.itemKeyField;
    if (itemsCollectionId) {
      const { items } = await getCollectionItems(itemsCollectionId, {
        limit: 100,
      });
      item = resolveItem(items, itemId, menuItemKeyField);
      if (item) pool = items;
    }
    if (!item) {
      for (const cid of siblingCollectionIds) {
        const { items } = await getCollectionItems(cid, { limit: 100 });
        const hit = resolveItem(items, itemId, menuItemKeyField);
        if (hit) {
          item = hit;
          pool = items;
          break;
        }
      }
    }
    if (!item) return redirectOrNotFound(siteData, `/${slug}/${itemId}`);

    // Related shelf: same category first (excluding self), then the rest —
    // href OVERRIDDEN to the item's own detail page so the shelf never
    // follows the item-authored order link. Sibling collections rarely carry
    // a category field, so their whole pool matches (e.g. "More Cakes").
    const category = (item.raw as { category?: unknown } | undefined)?.category;
    const sameCategory = pool.filter(
      (it) =>
        it.id !== item!.id &&
        (typeof category !== "string" ||
          (it.raw as { category?: unknown } | undefined)?.category === category)
    );
    const relatedItems = sameCategory.map((it) => ({
      ...it,
      href: `/${slug}/${itemSegment(it, menuItemKeyField)}`,
    }));

    const cleanDesc =
      typeof item.description === "string"
        ? item.description.replace(/<[^>]*>/g, "").slice(0, 500)
        : undefined;
    const itemJsonLd = buildDetailJsonLd({
      format: "products",
      title: item.title || pageConfig.name,
      description: cleanDesc,
      imageUrl: unsignMediaUrl(item.imageUrl),
      url: buildDetailUrl(siteData, slug, itemId),
      price: typeof item.price === "string" ? item.price : undefined,
      sku: item.id,
    });

    return (
      <>
        <JsonLd schema={itemJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format={pageConfig.format}
          item={item as unknown as DetailItem}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={pageConfig.detailPage as DetailPageConfig | undefined}
          relatedItems={relatedItems}
        />
        <Footer />
      </>
    );
  }

  // Phase 0 of the two-axis detail-route design (§5.1, §7.2 step 10) — the
  // WS3 301 redirect mechanism.
  //
  // docs/bugs/templates-soft-404-and-301-status, Change A / Open Question 2:
  // this used to be the ONLY place in the file that could resolve a deep
  // authored redirect, and it was reachable ONLY when `pageConfig.format`
  // matched none of the named arms above — every named arm answered "does
  // this item exist?" and called `notFound()` inline, before this fallback
  // could ever run for it. That made a 2-segment authored redirect whose
  // `from` sits under a live page slug (e.g. `/shop/retired-sku`, `shop`
  // live) unreachable and hard-404 (measured; see plan.md §Change 1a).
  //
  // Now REDUNDANT for every named format (shows/team/products/collection-
  // list/menu): each of those arms' own missing-item branch calls
  // `redirectOrNotFound()` above, which resolves the identical redirect via
  // the same `resolveMissingItemRedirect()` (which already composes
  // `resolveRedirect()` with the `isSameOriginRedirectTarget()` guard).
  //
  // docs/bugs/page-layer-unvalidated-redirect-target: the guard gap this
  // comment used to note here ("a pre-existing gap this diff does not close
  // here") is CLOSED — this fallback now goes through the same
  // `resolveMissingItemRedirect()` helper as `redirectOrNotFound()` and the
  // `!pageConfig` branch above, instead of a bare `resolveRedirect()` +
  // `permanentRedirect()` with no same-origin check. All three of this
  // file's redirect call sites, plus `[slug]/page.tsx` and
  // `[...segments]/page.tsx`, now share one decision function — see
  // `@/lib/redirects.ts`'s `isSameOriginRedirectTarget` doc comment.
  //
  // Still genuinely reachable, and still needed, for a `pageConfig.format`
  // that matches NO arm in this file at all (e.g. schedule, subscribe,
  // checkout-success, checkout-cancel, home) — every real arm above already
  // returned in that case, so a redirect resolved here can never shadow live
  // content by construction. `siteData.redirects` is absent/empty for every
  // site with nothing renamed (the fleet default), so `resolveRedirect`
  // short-circuits to `undefined` with one length check — zero extra
  // upstream calls, byte-identical to today.
  const redirectTarget = resolveMissingItemRedirect(siteData.redirects, `/${slug}/${itemId}`);
  if (redirectTarget) permanentRedirect(redirectTarget);

  return notFound();
}

/**
 * Resolve a menu page's detail-searchable collections from its blocks. Menu
 * pages carry a categories + items binding pair (on a monolith page-template
 * block or a coordinated group's `menu-items` child) — mirror the renderer's
 * blocks.ts resolution: `sectionConfig.menuRole === 'items'` wins, then a
 * binding titled like "items", then the LAST binding (the monolith fallback).
 * Every OTHER collection binding except the categories one (whose objects are
 * category headers, never detail items) is a SIBLING pool — e.g. the bakery
 * catering page's cakes carousel — searched when the item isn't a menu item.
 */
function resolveMenuDetailCollections(pageConfig: { blocks?: unknown }): {
  itemsCollectionId: string | undefined;
  siblingCollectionIds: string[];
} {
  type LooseBinding = {
    collectionId?: string;
    title?: string;
    sectionConfig?: { menuRole?: string };
  };
  type LooseBlock = {
    type?: { kind?: string };
    config?: { bindings?: LooseBinding[]; children?: LooseBlock[] };
  };
  const collect = (blocks: LooseBlock[]): LooseBinding[] =>
    blocks.flatMap((b) => [
      ...(b?.config?.bindings ?? []),
      ...(Array.isArray(b?.config?.children) ? collect(b.config.children) : []),
    ]);
  const bindings = collect(
    Array.isArray(pageConfig.blocks) ? (pageConfig.blocks as LooseBlock[]) : []
  ).filter((b) => b.collectionId);
  const itemsB =
    bindings.find((b) => b.sectionConfig?.menuRole === "items") ??
    bindings.find((b) => (b.title ?? "").toLowerCase().includes("item")) ??
    bindings[bindings.length - 1];
  const categoriesB =
    bindings.find((b) => b.sectionConfig?.menuRole === "categories") ??
    bindings.find((b) => (b.title ?? "").toLowerCase().includes("categor"));
  const seen = new Set<string>();
  const siblingCollectionIds = bindings
    .filter(
      (b) =>
        b !== itemsB &&
        b !== categoriesB &&
        b.collectionId !== itemsB?.collectionId &&
        b.collectionId !== categoriesB?.collectionId
    )
    .map((b) => b.collectionId!)
    .filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
  return { itemsCollectionId: itemsB?.collectionId, siblingCollectionIds };
}

export async function generateMetadata({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  const origin = resolveSiteOrigin(siteData, { prefer: 'deployed' });
  const routeCanonicalMetadata = buildRouteCanonicalMetadata(siteData, `/${slug}/${itemId}`);

  // CP-11: metadata for nested sub-pages resolved via the joined slug.
  const nestedPage = getPageBySlug(siteData, `${slug}/${itemId}`);
  if (nestedPage) {
    const seo = nestedPage.seo;
    const derived = nestedPage.labels?.title || nestedPage.name;
    const title = seo?.metaTitle || `${derived} | ${siteName}`;
    const description =
      seo?.metaDescription || nestedPage.labels?.subtitle || `${derived} — ${siteName}`;
    // OG route is a single dynamic segment; use the first URL segment so it
    // always resolves (nested pages fall back to the site card).
    const ogImageUrl = buildOgImageUrl(origin, slug);
    return {
      title,
      description,
      ...routeCanonicalMetadata,
      openGraph: {
        title,
        description,
        url: `${origin}/${slug}/${itemId}`,
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

  const pageConfig = getPageBySlug(siteData, slug);

  if (!pageConfig) {
    return { title: `Not Found | ${siteName}` };
  }

  // Detail items inherit the parent page's Studio SEO text + OG image. The OG
  // image points at the stable `/og/[slug]` route (which proxies the page's
  // uploaded image, else a branded card) rather than the item's own media URL:
  // item media is a CloudFront-signed URL that 403s after the 300s signature TTL
  // (the pre-existing bug this replaces). The OG route re-signs on every request,
  // so its URL never expires in crawler caches.
  const seo = pageConfig.seo;
  const ogImageUrl = buildOgImageUrl(origin, slug);
  const itemUrl = `${origin}/${slug}/${itemId}`;

  if (pageConfig.format === "shows") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.SHOWS_ID || "");
    const show = await getShowById(itemId, collectionId);
    if (!show) {
      return { title: `Not found | ${siteName}` };
    }
    const cleanDesc = show.description?.replace(/<[^>]*>/g, "").slice(0, 160);
    const title = seo?.metaTitle || `${show.title} | ${siteName}`;
    const description = seo?.metaDescription || cleanDesc || `${show.title} — ${siteName}`;
    return {
      title,
      description,
      ...routeCanonicalMetadata,
      openGraph: {
        title,
        description,
        url: itemUrl,
        type: "article",
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

  if (pageConfig.format === "team") {
    const teamMembers = await getTeamMembers();
    const member = teamMembers.find((m) => m.id === itemId);
    const name = member?.name;
    const title =
      seo?.metaTitle || (name ? `${name} | ${siteName}` : `Team Member | ${siteName}`);
    const description =
      seo?.metaDescription ||
      (name ? `Learn more about ${name} at ${siteName}.` : `Team member at ${siteName}.`);
    return {
      title,
      description,
      ...routeCanonicalMetadata,
      openGraph: {
        title,
        description,
        url: itemUrl,
        type: "article",
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

  // Two-axis detail-route design, Phase 3 (§7.2/§7.3, T3) — per-item/per-cell
  // title/description patterns + canonical tag. Fetches the item ONLY when
  // the page actually configures the detail route beyond defaults (absent
  // ⇒ zero extra fetches, the exact pre-existing "no per-item fetch" default
  // below runs unchanged — this ALSO fixes the pre-existing single-axis
  // defect where every item under a page shared one title, §2.3).
  const detailPage = pageConfig.detailPage;
  const seoPatterns = detailPage?.seo;
  const hasDetailRouteConfig = !!(
    detailPage?.itemCollectionId ||
    detailPage?.itemKeyField ||
    detailPage?.scope ||
    detailPage?.context ||
    seoPatterns
  );

  if (hasDetailRouteConfig) {
    const collectionId =
      detailPage?.itemCollectionId || getPageCollectionId(siteData, pageConfig.name, "");
    if (collectionId) {
      const { items: unscopedItems } = await getCollectionItems(collectionId, { limit: 100 });
      const scopedItems = applyScope(unscopedItems, detailPage?.scope);
      const item = resolveItem(scopedItems, itemId, detailPage?.itemKeyField);
      if (item) {
        const contextRaw = await resolveDetailContext(detailPage?.context);
        const effectiveItem = applyContextOverrides(item, contextRaw, detailPage?.context?.overrides);

        const patternData = {
          item: effectiveItem.raw ?? {},
          context: contextRaw ?? null,
          siteName,
        };
        const patternTitle = resolvePattern(seoPatterns?.titlePattern, patternData);
        const patternDescription = resolvePattern(seoPatterns?.descriptionPattern, patternData);

        const title = seo?.metaTitle || patternTitle || `${pageConfig.name} | ${siteName}`;
        const description =
          seo?.metaDescription ||
          patternDescription ||
          pageConfig.labels?.subtitle ||
          `${pageConfig.name} — ${siteName}`;

        // §15.2 — 'self' is the default the moment `scope` is authored (cells
        // are distinct by construction); otherwise absent ⇒ no canonical tag,
        // matching every other page on the fleet today.
        const canonicalFrom = seoPatterns?.canonicalFrom ?? (detailPage?.scope ? "self" : undefined);
        const canonical = resolveDetailCanonical({
          origin,
          pageConfigs: siteData.pageConfigs ?? [],
          currentPage: pageConfig,
          currentUrl: itemUrl,
          item: effectiveItem,
          canonicalFrom,
        });

        return {
          title,
          description,
          ...buildRouteCanonicalMetadata(siteData, `/${slug}/${itemId}`, canonical),
          openGraph: {
            title,
            description,
            url: itemUrl,
            type: "article",
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
      // Item not found under this config (a doorway miss or a genuine 404) —
      // fall through to the default below rather than special-casing "not
      // found" text here; the page component is the source of truth for 404.
    }
  }

  // Products + any other item detail. Kept lightweight (no per-item fetch): the
  // section name is the sensible default title. `seo` still overrides.
  const title = seo?.metaTitle || `${pageConfig.name} | ${siteName}`;
  const description =
    seo?.metaDescription || pageConfig.labels?.subtitle || `${pageConfig.name} — ${siteName}`;
  return {
    title,
    description,
    ...routeCanonicalMetadata,
    openGraph: {
      title,
      description,
      url: itemUrl,
      type: "article",
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
