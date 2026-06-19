import {
  Footer as RendererFooter,
  deriveNav,
  deriveFooterPages,
} from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { getSiteData } from '@/lib/api/siteData';
import { getSignedUrl } from '@/lib/api/media';

/**
 * Site footer. Thin server-side data shell around the renderer's <Footer>
 * (Group B one-footer model): fetches siteData + signed logo, threads the Q3b
 * overrides (columns / legal / hidePoweredBy / social) AND the Group-B footer
 * brand override.
 *
 * Group B chrome resolution:
 *  - The renderer renders the ONE footer from the explicit columns when present,
 *    else from the canonical derive (it runs `deriveChrome` internally when given
 *    `pageConfigs`). We pass `pageConfigs` so un-migrated sites still render.
 *  - Brand override is PER-FIELD: render value = `brand.<field>` when the KEY IS
 *    PRESENT (an empty string is an honored override → renders nothing), else
 *    inherit `businessInfo.<field>`. The renderer cannot sign URLs, so the
 *    override logo is signed HERE (mirroring the businessInfo logo) from the
 *    backend-delivered signed media object on `brand.logo`.
 *  - "Powered by Vivreal" attribution stays tier-gated.
 */
const Footer = async () => {
  const siteData = await getSiteData();

  const businessName = siteData?.businessInfo?.name || siteData?.name || '';
  const businessLogoUrl = getSignedUrl(siteData?.logo) || '/logo.png';
  const businessEmail = siteData?.businessInfo?.contactInfo?.email;

  // Per-field inherit/override. A key being PRESENT on `brand` (even "") is an
  // override; ABSENT inherits the businessInfo value. `Object.prototype
  // .hasOwnProperty` is what distinguishes absent from present-empty — `?.field`
  // would conflate `undefined` (absent) with a real "" override.
  const brand = siteData?.footer?.brand ?? undefined;
  const has = (k: string): boolean =>
    !!brand && Object.prototype.hasOwnProperty.call(brand, k);

  const siteName = has('name') ? (brand!.name ?? '') : businessName;
  const email = has('email') ? (brand!.email ?? '') : businessEmail;
  // Override logo: sign the backend-delivered media object for brand.logoKey.
  // When the override key is present but no signed media object is delivered yet
  // (backend signing pending), an empty string renders no logo (honored override).
  const logoUrl = has('logoKey')
    ? getSignedUrl(brand!.logo)
    : businessLogoUrl;

  const pageConfigs = (siteData?.pageConfigs ?? []) as unknown as RendererPageConfig[];
  const navItems = deriveNav(pageConfigs);
  const footerPages = deriveFooterPages(pageConfigs);

  // Footer social overrides win over the site-level social links.
  const socialLinks =
    siteData?.footer?.socialLinks ??
    (siteData?.socialLinks ?? []).map((l) => ({ platform: l.type, url: l.link }));

  return (
    <RendererFooter
      siteName={siteName}
      logoUrl={logoUrl}
      email={email}
      navItems={navItems}
      socialLinks={socialLinks}
      accentColor={siteData?.primary}
      tier={siteData?.tier}
      hidePoweredBy={siteData?.footer?.hidePoweredBy ?? false}
      footerColumns={siteData?.footer?.columns ?? null}
      legal={siteData?.footer?.legal ?? null}
      footerPages={footerPages}
      pageConfigs={pageConfigs}
    />
  );
};

export default Footer;
