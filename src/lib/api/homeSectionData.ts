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
  const result: Record<string, Record<string, unknown>> = {};

  /** Stable key for a section: `type-order` to avoid collisions when two sections share a type. */
  const sectionKey = (s: HomeSection) => `${s.type}-${s.order}`;

  // Build an array of { sKey, promise } entries — we'll resolve them all at once.
  const jobs: Array<{ sKey: string; key: string; promise: Promise<unknown> }> = [];

  // ── hero ──────────────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "hero")) {
    const sk = sectionKey(s);
    const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
    const partnersCollectionId = getPageCollectionId(siteData, "partners", process.env.PARTNERS_ID || "");

    jobs.push({ sKey: sk, key: "showsResult", promise: getShowsPaginated({ collectionId: showsCollectionId, limit: 100 }) });
    jobs.push({ sKey: sk, key: "partners", promise: getPartners(partnersCollectionId) });
  }

  // ── highlights ────────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "highlights")) {
    const sk = sectionKey(s);
    const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
    const teamCollectionId = findCollectionId(siteData, "team") ?? "";
    const partnersCollectionId = getPageCollectionId(siteData, "partners", process.env.PARTNERS_ID || "");

    jobs.push({ sKey: sk, key: "shows", promise: getShowsPaginated({ collectionId: showsCollectionId, limit: 100 }) });
    jobs.push({ sKey: sk, key: "members", promise: getTeamMembers(teamCollectionId) });
    jobs.push({ sKey: sk, key: "partners", promise: getPartners(partnersCollectionId) });
  }

  // ── testimonials ──────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "testimonials")) {
    const sk = sectionKey(s);
    const reviewCollectionId = findCollectionId(siteData, "form") || findCollectionId(siteData, "review") || "";
    jobs.push({ sKey: sk, key: "reviews", promise: getReviews(reviewCollectionId) });
  }

  // ── hero-ecommerce ────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "hero-ecommerce")) {
    const sk = sectionKey(s);
    const collectionId = (s.config.collectionId as string) || findCollectionId(siteData, "landing") || "";
    jobs.push({ sKey: sk, key: "landingSections", promise: getLandingSections(collectionId) });
  }

  // ── product-showcase ──────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "product-showcase")) {
    const sk = sectionKey(s);
    const collectionId = (s.config.collectionId as string) || findCollectionId(siteData, "product-showcase") || "";
    const landingCollectionId = findCollectionId(siteData, "landing") || "";
    jobs.push({ sKey: sk, key: "items", promise: getProductShowcase(collectionId) });
    jobs.push({ sKey: sk, key: "landingSections", promise: getLandingSections(landingCollectionId) });
  }

  // ── offerings ─────────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "offerings")) {
    const sk = sectionKey(s);
    const collectionId = (s.config.collectionId as string) || findCollectionId(siteData, "offerings") || "";
    jobs.push({ sKey: sk, key: "items", promise: getOfferings(collectionId) });
  }

  // ── contact ───────────────────────────────────────────────────────
  for (const s of sections.filter((s) => s.type === "contact")) {
    const sk = sectionKey(s);
    const collectionId = (s.config.collectionId as string) || findCollectionId(siteData, "landing") || "";
    jobs.push({ sKey: sk, key: "landingSections", promise: getLandingSections(collectionId) });
  }

  // ── cta / email-popup need no server data ─────────────────────────

  // Resolve all in parallel
  const settled = await Promise.all(jobs.map((j) => j.promise.catch(() => undefined)));

  // Group resolved values by section key (type-order)
  for (let i = 0; i < jobs.length; i++) {
    const { sKey, key } = jobs[i];
    if (!result[sKey]) result[sKey] = {};
    result[sKey][key] = settled[i];
  }

  // ── Post-process: assemble the shapes each component expects ──────
  for (const s of sections) {
    const sk = sectionKey(s);
    if (!result[sk]) continue;

    switch (s.type) {
      case "hero": {
        const showsResult = result[sk].showsResult as { shows: unknown[] } | undefined;
        result[sk] = {
          shows: showsResult?.shows ?? [],
          partners: result[sk].partners ?? [],
          labels: {
            upcoming: getPageLabel(siteData, "shows", "upcoming", "Upcoming"),
            past: getPageLabel(siteData, "shows", "past", "Past"),
          },
          showsSlug: siteData.pageConfigs?.find((p) => p.format === "shows")?.slug || "shows",
        };
        break;
      }
      case "highlights": {
        const shows = result[sk].shows as { shows: unknown[] } | undefined;
        const members = result[sk].members as unknown[] | undefined;
        const partners = result[sk].partners as unknown[] | undefined;
        result[sk] = {
          showCount: shows?.shows?.length ?? 0,
          memberCount: members?.length ?? 0,
          venueCount: partners?.length ?? 0,
        };
        break;
      }
      case "testimonials": {
        result[sk] = {
          reviews: result[sk].reviews ?? [],
          reviewsHeading: getPageLabel(siteData, "review", "heading", "What People Are Saying"),
        };
        break;
      }
      case "hero-ecommerce": {
        const sections_data = result[sk].landingSections as Record<string, unknown> | undefined;
        result[sk] = {
          heroSection: sections_data?.["hero"] ?? sections_data?.["Hero"] ?? undefined,
        };
        break;
      }
      case "product-showcase": {
        const landingSections = result[sk].landingSections as Record<string, unknown> | undefined;
        result[sk] = {
          items: result[sk].items ?? [],
          productShowcaseSection: landingSections?.["product-showcase"] ?? landingSections?.["Product Showcase"] ?? undefined,
        };
        break;
      }
      case "offerings":
        // Already in the right shape: { items: OfferingItem[] }
        break;
      case "contact": {
        const sections_data = result[sk].landingSections as Record<string, unknown> | undefined;
        result[sk] = {
          contactUs: sections_data?.["contact-us"] ?? sections_data?.["Contact Us"] ?? undefined,
        };
        break;
      }
    }
  }

  return result;
}
