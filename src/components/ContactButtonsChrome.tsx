'use client';

import { usePathname } from 'next/navigation';
import { ContactButtons, type SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';
import type { ContactButtonsSiteData } from '@/lib/contactButtons';
import { SITE_BASE_PATH } from '@/lib/sitePath';

/**
 * Client bridge for the renderer's contact bar (search R3). The root layout
 * mounts it once for every route and cannot know which page is rendering, so
 * the path comes from `usePathname()` here, as in `NavbarChrome`.
 *
 * FP2-55 (W25rc-6, renderer 1.85.5 `currentPath`): on the inquiry page itself
 * the bar drops Inquire rather than linking to the page the visitor is on.
 */
export default function ContactButtonsChrome({ siteData }: { siteData: ContactButtonsSiteData }) {
  const pathname = usePathname();
  // Cast: the slice carries every field `resolveContactButtons` reads.
  // `basePath` (F270, TP-10): the bar renders on the server side of the
  // renderer and reads no context, so the base goes in as a prop.
  return <ContactButtons siteData={siteData as RendererSiteData} currentPath={pathname} basePath={SITE_BASE_PATH} />;
}
