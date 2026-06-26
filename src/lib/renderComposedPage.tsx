import 'server-only';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import { composePage } from '@hillbombcreations/site-renderer';
import { buildPageContext } from '@/lib/api/composition/buildPageContext';
import type { PageConfig, SiteData } from '@/types/SiteData';

// Formats that trigger isEmpty → notFound(). Mirrors [slug]/page.tsx SP-6 Task 5.
const GENERIC_FORMATS = new Set(['standard', 'list', 'grid']);

/**
 * Renders the generic composed-page path (about / standard / list / grid / static).
 *
 * Shared between [slug]/page.tsx (generic + static branches) and
 * [slug]/[itemId]/page.tsx (CP-11 nested sub-page branch) so the two cannot drift.
 *
 * Caller MUST pre-shape `composedPage` before calling:
 *  - static/privacy/terms: synthesize labels from getPageLabel, build the PageConfig.
 *  - about/standard/list/grid: pass pageConfig through unchanged.
 *
 * Formats that require runtime component overrides (products, schedule, subscribe)
 * and interactive/detail formats (shows, team, checkout-*) must NOT be routed
 * here — they are handled by their own arms in [slug]/page.tsx.
 *
 * Mirrors the isEmpty guard (SP-6 Task 5) and the transitional title band
 * (SP-6 Task 5 Concern-3) from [slug]/page.tsx so the two cannot drift.
 */
export async function renderComposedPage({
  siteData,
  composedPage,
}: {
  siteData: SiteData;
  composedPage: PageConfig;
}) {
  const { input, isEmpty } = await buildPageContext({
    siteData,
    page: composedPage,
    isHome: false,
  });

  const format = composedPage.format;

  // SP-6 Task 5 isEmpty guard — only fires for generic formats.
  // Mirrors the guard in [slug]/page.tsx so the two stay in sync.
  if (isEmpty && GENERIC_FORMATS.has(format)) {
    return notFound();
  }

  // SP-6 Task 5 Concern-3: transitional title band (B-wrapper fallback).
  // Mirrors [slug]/page.tsx exactly. Self-disables once the page carries a
  // section-header block (B-author model).
  const isGenericFormat = GENERIC_FORMATS.has(format);
  const hasLabelTitle = !!(composedPage.labels?.title);
  const hasSectionHeaderBlock = (composedPage.blocks ?? []).some(
    (b) => b?.type?.dispatchId === 'section-header',
  );
  const showTransitionalTitleBand = isGenericFormat && hasLabelTitle && !hasSectionHeaderBlock;

  // Dark-chrome transitional title band: when siteData.chrome === 'dark', the
  // band gets a full-width navy gradient (matching BannerLayout / SectionHeaderBlock
  // dark treatment) with text-inverse text, centered layout, and generous padding.
  // Light-chrome behavior is byte-identical to the previous implementation.
  const darkChrome = siteData.chrome === 'dark';

  return (
    <>
      <Navbar />
      {showTransitionalTitleBand && (
        // Transitional title band: renders the legacy page.labels.title/subtitle
        // so generic pages that haven't been SP-3-backfilled still show their H1.
        // Self-disables once the page carries a section-header block (B-author model).
        darkChrome ? (
          // Dark-chrome: full-width navy hero band, centered, text-inverse.
          // Outer div carries the full-width background; inner content-grid constrains
          // the text (same split used by BannerLayout and SectionHeaderBlock dark mode).
          <div
            style={{
              background:
                'linear-gradient(135deg, var(--surface-alt, #1a1a2e), color-mix(in srgb, var(--surface-alt, #1a1a2e) 88%, var(--primary, #111)))',
            }}
          >
            <div className="content-grid pt-32 pb-16 text-center">
              <h1
                className="text-3xl md:text-5xl font-bold tracking-tight"
                style={{ color: 'var(--text-inverse, #ffffff)', fontFamily: 'var(--font-display)' }}
              >
                {composedPage.labels.title}
              </h1>
              {composedPage.labels.subtitle && (
                <p
                  className="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
                  style={{ color: 'color-mix(in srgb, var(--text-inverse, #fff) 70%, transparent)' }}
                >
                  {composedPage.labels.subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          // Light-chrome: legacy layout (content-grid pt-28 pb-0, left-aligned h1).
          <div className="content-grid pt-28 pb-0">
            <header className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
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
        )
      )}
      {composePage(input)}
      <Footer />
    </>
  );
}
