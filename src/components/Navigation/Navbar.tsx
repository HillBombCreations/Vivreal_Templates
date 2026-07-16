import { deriveNav } from '@hillbombcreations/site-renderer';
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
const Navbar = async () => {
  const siteData = await getSiteData();

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
      // Gate-2 §7 — overlay menu opt-in. Pass-through only: the renderer's
      // resolveMediaSrc reads a pre-signed URL string or an inlined
      // currentFile.source descriptor (this shell does no signing for it — the
      // loader/preview supply it inlined, same contract as NavMenuItem.image).
      menuStyle={siteData?.navigation?.menuStyle ?? null}
      overlayBackground={siteData?.navigation?.overlayBackground ?? null}
      // Typed in NavbarProps as of renderer 1.24.0 — spread-cast retired.
      headerWidth={siteData?.navigation?.headerWidth ?? null}
      logoHeight={siteData?.navigation?.brand?.logoHeight ?? null}
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
