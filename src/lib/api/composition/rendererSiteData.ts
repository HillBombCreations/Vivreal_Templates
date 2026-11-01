import type { PageConfig, SiteData } from '@/types/SiteData';
// The renderer's own `{ platform, url }` (what `resolveLinkStack` and the social row read).
import type { SocialLink as RendererSocialLink } from '@hillbombcreations/site-renderer';

/**
 * The site's stored social links (`{ type, link }`, Vivreal-Schemas
 * `SocialLinksSchema`) in the renderer's shape (`{ platform, url }`).
 *
 * WHY. The composed page hands the renderer the site data, and the renderer's
 * Link page buttons and social row match `platform` and read `url`. Nothing
 * mapped the stored shape on that path, so every social button on a live Link
 * page resolved to nothing and was dropped, while Studio (which maps) showed
 * them (#485 review, 2026-10-30). Footer and Navbar read the site's social
 * links through this same mapper (next release 2026-11, N6), so the owner's
 * `label` reaches every row that draws an icon.
 *
 * A row with no type or no link is dropped here. The https rule is NOT applied
 * here on purpose: the renderer applies `httpsOnly` to every social address
 * itself, so an `http:` link still renders no button, and the first stored
 * account of a platform stays the one it matches, exactly as before.
 */
export function toRendererSocialLinks(socialLinks: SiteData['socialLinks'] | undefined | null): RendererSocialLink[] {
  if (!Array.isArray(socialLinks)) return [];
  return socialLinks.flatMap((row) => {
    const platform = typeof row?.type === 'string' ? row.type.trim() : '';
    const url = typeof row?.link === 'string' ? row.link.trim() : '';
    if (!platform || !url) return [];
    // The owner's own name for an Other link (owner Q12, Schemas 1.67.0,
    // next release 2026-11 N6). Carried only when it says something; the
    // renderer draws it only for `other` or a platform its list does not know.
    const label = typeof row?.label === 'string' ? row.label.trim() : '';
    return [label ? { platform, url, label } : { platform, url }];
  });
}

/**
 * The site data the composed page hands the renderer: the stored data with
 * `socialLinks` in the renderer's shape. Everything else is passed unchanged.
 */
export function toRendererSiteData(siteData: SiteData): Omit<SiteData, 'socialLinks'> & { socialLinks: RendererSocialLink[] } {
  return { ...siteData, socialLinks: toRendererSocialLinks(siteData.socialLinks) };
}

/**
 * The page list the renderer's menu derives (`deriveNav`, `deriveFooterPages`)
 * read: the home page first, then every other page.
 *
 * WHY. `getSiteData` splits the home page out of `pageConfigs`, so the menus
 * never saw it and the first menu item always read "Home". The Studio preview
 * hands the derives every page, home included, so an owner who renamed the home
 * page saw that name in the Studio and "Home" on the live site (owner, next
 * release 2026-11: live menus show the owner's name). Renderer 1.94.1 names the
 * first item after the home page and never lists the home page again, so a
 * blank site's seeded home page still shows one "Home" (WD-5).
 *
 * Menus only. The chrome's own `pageConfigs` props keep the list without home:
 * there it also drives the cart icon and the derived footer columns, which this
 * change does not move.
 */
export function menuPageConfigs(
  siteData: Pick<SiteData, 'homePageConfig' | 'pageConfigs'> | null | undefined,
): PageConfig[] {
  const pages = siteData?.pageConfigs ?? [];
  const home = siteData?.homePageConfig;
  return home ? [home, ...pages] : pages;
}
