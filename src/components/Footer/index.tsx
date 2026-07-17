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
  // No logo ⇒ '' (the renderer gates the footer <img> on truthiness → name-only).
  // '/logo.png' does not exist in public/ — the old fallback rendered a broken
  // image on every logo-less site.
  const businessLogoUrl = getSignedUrl(siteData?.logo) || '';
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
  // Wave D — footer tagline: brand override wins, else businessInfo.description.
  const description = has('description')
    ? (brand!.description ?? '')
    : siteData?.businessInfo?.description;
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
      chrome={siteData?.chrome as 'dark' | 'light' | undefined}
      newsletter={siteData?.footerNewsletter ?? null}
      // Wave D + owner pass 2: these land in FooterProps on the next renderer
      // bump — drop this spread-cast then and pass them as plain props.
      {...({
        description: description ?? null,
        socialStyle: siteData?.footer?.socialStyle ?? undefined,
        newsletterPlacement: siteData?.footer?.newsletterPlacement ?? undefined,
        logoFilter: siteData?.footer?.brand?.logoFilter ?? null,
        // Levain round — centerpiece footer (centered brand+newsletter over an
        // authored background). Opt-in; absent keeps the grid byte-identical.
        variant: siteData?.footer?.variant ?? null,
        background: siteData?.footer?.background ?? null,
        // Poilâne round — wordmark-footer extras (rotating stamp seal +
        // service-ticker marquee). Opt-in; absent renders nothing.
        stamp: siteData?.footer?.stamp ?? null,
        ticker: siteData?.footer?.ticker ?? null,
      } as Record<string, unknown>)}
    />
  );
};

export default Footer;
