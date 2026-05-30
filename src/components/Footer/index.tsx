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
 * (1.0 site chrome): fetches siteData + signed logo, derives the nav + the
 * displayOnFooter "legal" links (via deriveFooterPages, which preserves the
 * privacy/terms links the old footer auto-listed), maps social links to the
 * renderer's shape, and threads Q3b overrides (footerColumns / legal /
 * hidePoweredBy). The "Powered by Vivreal" attribution is tier-gated.
 */
const Footer = async () => {
  const siteData = await getSiteData();

  const siteName = siteData?.businessInfo?.name || siteData?.name || '';
  const logoUrl = getSignedUrl(siteData?.logo) || '/logo.png';
  const pageConfigs = (siteData?.pageConfigs ?? []) as unknown as RendererPageConfig[];
  const navItems = deriveNav(pageConfigs);
  const footerPages = deriveFooterPages(pageConfigs);
  const socialLinks = (siteData?.socialLinks ?? []).map((l) => ({
    platform: l.type,
    url: l.link,
  }));

  return (
    <RendererFooter
      siteName={siteName}
      logoUrl={logoUrl}
      email={siteData?.businessInfo?.contactInfo?.email}
      navItems={navItems}
      socialLinks={socialLinks}
      accentColor={siteData?.primary}
      tier={siteData?.tier}
      hidePoweredBy={siteData?.footer?.hidePoweredBy ?? false}
      footerColumns={siteData?.footer?.columns ?? null}
      legal={siteData?.footer?.legal ?? null}
      footerPages={footerPages}
    />
  );
};

export default Footer;
