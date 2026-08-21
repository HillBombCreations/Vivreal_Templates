import { deriveNav, resolveHeaderPinned, resolveMastheadTone } from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { getSiteData } from '@/lib/api/siteData';
import { getSignedUrl } from '@/lib/api/media';
import NavbarChrome from './NavbarChrome';

/**
 * Site header. Thin server-side data shell around the renderer's <Navbar>
 * (1.0 site chrome + Group B brand override / cart-icon): fetches siteData +
 * signed logo, derives header nav via the renderer's deriveNav, and threads the
 * Q3b overrides (menuItems / cta) plus Group-B header brand + cartIcon. Cart
 * wiring (count + open handler) lives in the NavbarChrome client bridge.
 *
 * Group B header brand is PER-FIELD inherit/override, symmetric with the footer:
 * render value = `brand.<field>` when the KEY IS PRESENT (incl. "" → renders
 * nothing), else inherit `businessInfo.<field>`. The renderer can't sign URLs,
 * so the override logo is signed HERE from the backend-delivered signed media
 * object on `brand.logo`.
 */
/**
 * H1 (saas-1 kit, renderer 1.54.0) — `page` is the CURRENT route's (raw,
 * pre-compose) PageConfig. The shell derives the masthead tone from its
 * authored hero with the renderer's own `resolveMastheadTone` and threads it
 * as `mastheadTone`, so a `transparent-on-hero` header lands on the solid
 * token set at scroll 0 over a LIGHT masthead (a media-less `statement`
 * hero) instead of painting white ink on white. Omitting `page` ⇒ `null` ⇒
 * the renderer's pre-1.54.0 behaviour, byte-identical — the detail-page
 * mounts and the welcome fallback pass nothing.
 *
 * GATE-1b (saas-1 kit, same renderer train) — the SAME `page` also decides
 * whether the header stays PINNED: `resolveHeaderPinned(page)` is `false`
 * only when the page carries a `section-bar` binding in `mode:'replace'`
 * (the sticky product-family bar takes over the chrome once the hero scrolls
 * by, so the header must scroll away with it — Shopify /pos, Wix /ecommerce).
 * Every page without a bar, and every mount that passes no `page`, resolves
 * `true` ⇒ the fixed header, byte-identical. Item-18 lockstep: the Studio
 * preview wrapper (Vivreal_Portal_Mobile/.../preview-shell/page.tsx) threads
 * the same derivation.
 */
const Navbar = async ({ page }: { page?: RendererPageConfig | null } = {}) => {
  const siteData = await getSiteData();
  const mastheadTone = resolveMastheadTone(page ?? null);
  const pinned = resolveHeaderPinned(page ?? null);

  const businessName = siteData?.businessInfo?.name || siteData?.name || '';
  // No logo ⇒ '' (renderer NavbarView gates the <img> on truthiness → name-only
  // wordmark). '/logo.png' does not exist in public/, so the old fallback
  // rendered a broken image on every logo-less site.
  const businessLogoUrl = getSignedUrl(siteData?.logo) || '';

  // Per-field inherit/override (presence-means-override; see Footer wrapper).
  const brand = siteData?.navigation?.brand ?? undefined;
  const has = (k: string): boolean =>
    !!brand && Object.prototype.hasOwnProperty.call(brand, k);

  const siteName = has('name') ? (brand!.name ?? '') : businessName;
  const logoUrl = has('logoKey') ? getSignedUrl(brand!.logo) : businessLogoUrl;

  const pageConfigs = (siteData?.pageConfigs ?? []) as unknown as RendererPageConfig[];
  const navItems = deriveNav(pageConfigs);

  return (
    <NavbarChrome
      siteName={siteName}
      logoUrl={logoUrl}
      navItems={navItems}
      accentColor={siteData?.primary}
      pageConfigs={pageConfigs}
      menuItems={siteData?.navigation?.menuItems ?? null}
      cta={siteData?.navigation?.cta ?? null}
      secondaryCta={siteData?.navigation?.secondaryCta ?? null}
      headerStyle={siteData?.navigation?.headerStyle ?? null}
      mastheadTone={mastheadTone}
      pinned={pinned}
      // Gate-2 §7 — overlay menu opt-in. Pass-through only: the renderer's
      // resolveMediaSrc reads a pre-signed URL string or an inlined
      // currentFile.source descriptor (this shell does no signing for it — the
      // loader/preview supply it inlined, same contract as NavMenuItem.image).
      menuStyle={siteData?.navigation?.menuStyle ?? null}
      overlayBackground={siteData?.navigation?.overlayBackground ?? null}
      // Levain round — logo-center bar + image-card mega dropdowns (both
      // opt-in; null/absent keep the default bar byte-identical).
      layout={siteData?.navigation?.layout ?? null}
      // Poster-pop kit (musician template #1) — the 'band' chrome extras.
      // All three are inert unless layout === 'band' (renderer-gated):
      // bandColor = the solid bar color; linkColorCycle = the per-arm accent
      // cycle; socialLinks = the band's right-cluster icon rail, fed from the
      // site's own authored socials (top-level {type,link} wire shape mapped
      // to the renderer's {platform,url} — same mapping the Footer wrapper
      // uses; no fabrication, the rail null-outs when nothing is authored).
      bandColor={siteData?.navigation?.bandColor ?? null}
      linkColorCycle={siteData?.navigation?.linkColorCycle ?? null}
      socialLinks={(siteData?.socialLinks ?? []).map((l) => ({ platform: l.type, url: l.link }))}
      // Ansel kit (bakery template #3) — the boutique utility-header extras
      // (all boutique-only; null/absent keep every other layout byte-identical).
      brandKicker={siteData?.navigation?.brandKicker ?? null}
      centerLabel={siteData?.navigation?.centerLabel ?? null}
      utilityNote={siteData?.navigation?.utilityNote ?? null}
      dropdownStyle={siteData?.navigation?.dropdownStyle ?? null}
      // Universal (renderer 1.32.0) — resting nav link/trigger text color
      // ('accent' → brand primary, or a hex/rgb/hsl string). null/absent ⇒
      // today's chrome text, byte-identical.
      navLinkColor={siteData?.navigation?.navLinkColor ?? null}
      // REV-2 (Poilane round) — quiet uppercase text actions, right cluster.
      actions={siteData?.navigation?.actions ?? null}
      // Resale round — the net-new header SEARCH BAND (an arm in the bar that
      // opens a full-width band docked over the header). The band submits a
      // native GET form to the authored `action` + `queryParam`, so results
      // land on a REAL route (e.g. /shop?search=..., which the products
      // storefront already honours server-side). null/absent ⇒ no arm, no
      // band, byte-identical header.
      search={siteData?.navigation?.search ?? null}
      // saas-1 kit (vivreal.io relaunch) — the `layout:'mega'` vehicle's two
      // knobs. Same item-18 lockstep rule as the block above: a prop threaded
      // here but not in the Studio preview wrapper
      // (Vivreal_Portal_Mobile/.../preview-shell/page.tsx) is invisible in the
      // Studio, and a prop threaded there but not here is invisible on the
      // LIVE site. Both are wired. `megaDensity` absent/null/'detailed' ⇒ the
      // roomy default; `megaFeature` absent/heading-less ⇒ no featured rail —
      // and both are ignored outright by every layout that is not 'mega', so
      // every existing site's header is byte-identical.
      megaDensity={siteData?.navigation?.megaDensity ?? null}
      megaFeature={siteData?.navigation?.megaFeature ?? null}
      // Typed in NavbarProps as of renderer 1.24.0 — spread-cast retired.
      headerWidth={siteData?.navigation?.headerWidth ?? null}
      logoHeight={siteData?.navigation?.brand?.logoHeight ?? null}
      // H2 (renderer 1.54) — authored MINIMUM nav-row height, [40,120];
      // mobile derives as min(barHeight, 72) unless barHeightMobile is set.
      // Absent ⇒ today's logo-derived bar height, byte-identical.
      barHeight={siteData?.navigation?.barHeight ?? null}
      barHeightMobile={siteData?.navigation?.barHeightMobile ?? null}
      cartIcon={siteData?.navigation?.cartIcon ?? null}
      chrome={siteData?.chrome as 'dark' | 'light' | undefined}
      // Site-level announcement strip — rendered by the renderer INSIDE the
      // fixed header (spacer accounts for it automatically). Absent ⇒ nothing.
      announcement={siteData?.announcement ?? null}
      // Utility strip (identity kits §5.3) — same in-header contract as the
      // announcement; stacks under an 'above'-placed announcement.
      utilityStrip={siteData?.utilityStrip ?? null}
    />
  );
};

export default Navbar;
