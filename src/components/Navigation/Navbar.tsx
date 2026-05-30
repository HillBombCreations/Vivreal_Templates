import { deriveNav } from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { getSiteData } from '@/lib/api/siteData';
import { getSignedUrl } from '@/lib/api/media';
import NavbarChrome from './NavbarChrome';

/**
 * Site header. Thin server-side data shell around the renderer's <Navbar>
 * (1.0 site chrome): fetches siteData + signed logo, derives header nav via
 * the renderer's deriveNav (a faithful port of the old getNavigationData),
 * and threads Q3b Studio overrides (menuItems / cta). Cart wiring lives in
 * the NavbarChrome client bridge.
 */
const Navbar = async () => {
  const siteData = await getSiteData();

  const siteName = siteData?.businessInfo?.name || siteData?.name || '';
  const logoUrl = getSignedUrl(siteData?.logo) || '/logo.png';
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
    />
  );
};

export default Navbar;
