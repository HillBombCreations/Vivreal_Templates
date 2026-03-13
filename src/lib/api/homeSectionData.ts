import "server-only";
import type { HomeSection, SiteData } from "@/types/SiteData";
import { getShowsPaginated } from "@/lib/api/shows";
import { getPartners } from "@/lib/api/partners";
import { getTeamMembers } from "@/lib/api/team";
import { getReviews } from "@/lib/api/review";
import { getLandingSections, getProductShowcase, getOfferings } from "@/lib/api/landing";
import { getPageCollectionId, getPageLabel } from "@/lib/api/siteData";

/**
 * Find a page's collectionId by matching on format or name.
 */
function findCollectionId(siteData: SiteData, formatOrName: string): string | undefined {
  const pages = siteData.pageConfigs ?? [];
  const page = pages.find((p) => p.format === formatOrName || p.name === formatOrName);
  return page?.collectionId ?? undefined;
}

/**
 * Pre-fetch all data needed by the enabled home sections in parallel.
 *
 * Returns a map keyed by section type, where each value is the
 * `prefetchedData` record that HomeSectionRenderer passes to the component.
 */
export async function prefetchHomeSectionData(
  sections: HomeSection[],
  siteData: SiteData
): Promise<Record<string, Record<string, unknown>>> {
  const types = new Set(sections.map((s) => s.type));
  const result: Record<string, Record<string, unknown>> = {};

  // Build an array of { type, promise } entries — we'll resolve them all at once.
  const jobs: Array<{ type: string; key: string; promise: Promise<unknown> }> = [];

  // ── hero ──────────────────────────────────────────────────────────
  if (types.has("hero")) {
    const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
    const partnersCollectionId = getPageCollectionId(siteData, "partners", process.env.PARTNERS_ID || "");

    jobs.push({ type: "hero", key: "showsResult", promise: getShowsPaginated({ collectionId: showsCollectionId, limit: 5 }) });
    jobs.push({ type: "hero", key: "partners", promise: getPartners(partnersCollectionId) });
  }

  // ── highlights ────────────────────────────────────────────────────
  if (types.has("highlights")) {
    const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
    const teamCollectionId = findCollectionId(siteData, "team") ?? "";
    const partnersCollectionId = getPageCollectionId(siteData, "partners", process.env.PARTNERS_ID || "");

    jobs.push({ type: "highlights", key: "shows", promise: getShowsPaginated({ collectionId: showsCollectionId, limit: 100 }) });
    jobs.push({ type: "highlights", key: "members", promise: getTeamMembers(teamCollectionId) });
    jobs.push({ type: "highlights", key: "partners", promise: getPartners(partnersCollectionId) });
  }

  // ── testimonials ──────────────────────────────────────────────────
  if (types.has("testimonials")) {
    const reviewCollectionId = findCollectionId(siteData, "form") || findCollectionId(siteData, "review") || "";
    jobs.push({ type: "testimonials", key: "reviews", promise: getReviews(reviewCollectionId) });
  }

  // ── hero-ecommerce ────────────────────────────────────────────────
  if (types.has("hero-ecommerce")) {
    const section = sections.find((s) => s.type === "hero-ecommerce");
    const collectionId = (section?.config.collectionId as string) || findCollectionId(siteData, "landing") || "";
    jobs.push({ type: "hero-ecommerce", key: "landingSections", promise: getLandingSections(collectionId) });
  }

  // ── product-showcase ──────────────────────────────────────────────
  if (types.has("product-showcase")) {
    const section = sections.find((s) => s.type === "product-showcase");
    const collectionId = (section?.config.collectionId as string) || findCollectionId(siteData, "product-showcase") || "";
    const landingCollectionId = findCollectionId(siteData, "landing") || "";
    jobs.push({ type: "product-showcase", key: "items", promise: getProductShowcase(collectionId) });
    jobs.push({ type: "product-showcase", key: "landingSections", promise: getLandingSections(landingCollectionId) });
  }

  // ── offerings ─────────────────────────────────────────────────────
  if (types.has("offerings")) {
    const section = sections.find((s) => s.type === "offerings");
    const collectionId = (section?.config.collectionId as string) || findCollectionId(siteData, "offerings") || "";
    jobs.push({ type: "offerings", key: "items", promise: getOfferings(collectionId) });
  }

  // ── contact ───────────────────────────────────────────────────────
  if (types.has("contact")) {
    const section = sections.find((s) => s.type === "contact");
    const collectionId = (section?.config.collectionId as string) || findCollectionId(siteData, "landing") || "";
    jobs.push({ type: "contact", key: "landingSections", promise: getLandingSections(collectionId) });
  }

  // ── cta / email-popup need no server data ─────────────────────────

  // Resolve all in parallel
  const settled = await Promise.all(jobs.map((j) => j.promise.catch(() => undefined)));

  // Group resolved values by section type
  for (let i = 0; i < jobs.length; i++) {
    const { type, key } = jobs[i];
    if (!result[type]) result[type] = {};
    result[type][key] = settled[i];
  }

  // ── Post-process: assemble the shapes each component expects ──────

  if (result["hero"]) {
    const showsResult = result["hero"].showsResult as { shows: unknown[] } | undefined;
    result["hero"] = {
      shows: showsResult?.shows ?? [],
      partners: result["hero"].partners ?? [],
      labels: {
        upcoming: getPageLabel(siteData, "shows", "upcoming", "Upcoming"),
        past: getPageLabel(siteData, "shows", "past", "Past"),
      },
      showsSlug: siteData.pageConfigs?.find((p) => p.format === "shows")?.slug || "shows",
    };
  }

  if (result["highlights"]) {
    const shows = result["highlights"].shows as { shows: unknown[] } | undefined;
    const members = result["highlights"].members as unknown[] | undefined;
    const partners = result["highlights"].partners as unknown[] | undefined;
    result["highlights"] = {
      showCount: shows?.shows?.length ?? 0,
      memberCount: members?.length ?? 0,
      venueCount: partners?.length ?? 0,
    };
  }

  if (result["testimonials"]) {
    result["testimonials"] = {
      reviews: result["testimonials"].reviews ?? [],
      reviewsHeading: getPageLabel(siteData, "review", "heading", "What People Are Saying"),
    };
  }

  if (result["hero-ecommerce"]) {
    const sections_data = result["hero-ecommerce"].landingSections as Record<string, unknown> | undefined;
    result["hero-ecommerce"] = {
      heroSection: sections_data?.["hero"] ?? sections_data?.["Hero"] ?? undefined,
    };
  }

  if (result["product-showcase"]) {
    const landingSections = result["product-showcase"].landingSections as Record<string, unknown> | undefined;
    result["product-showcase"] = {
      items: result["product-showcase"].items ?? [],
      productShowcaseSection: landingSections?.["product-showcase"] ?? landingSections?.["Product Showcase"] ?? undefined,
    };
  }

  if (result["offerings"]) {
    // Already in the right shape: { items: OfferingItem[] }
  }

  if (result["contact"]) {
    const sections_data = result["contact"].landingSections as Record<string, unknown> | undefined;
    result["contact"] = {
      contactUs: sections_data?.["contact-us"] ?? sections_data?.["Contact Us"] ?? undefined,
    };
  }

  return result;
}
