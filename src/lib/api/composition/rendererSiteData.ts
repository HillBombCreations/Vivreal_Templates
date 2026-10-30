import type { SiteData } from '@/types/SiteData';
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
 * them (#485 review, 2026-10-30). Footer and Navbar map at their own call
 * sites (`src/components/Footer/index.tsx`, `src/components/Navigation/Navbar.tsx`)
 * and are not changed.
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
    return platform && url ? [{ platform, url }] : [];
  });
}

/**
 * The site data the composed page hands the renderer: the stored data with
 * `socialLinks` in the renderer's shape. Everything else is passed unchanged.
 */
export function toRendererSiteData(siteData: SiteData): Omit<SiteData, 'socialLinks'> & { socialLinks: RendererSocialLink[] } {
  return { ...siteData, socialLinks: toRendererSocialLinks(siteData.socialLinks) };
}
