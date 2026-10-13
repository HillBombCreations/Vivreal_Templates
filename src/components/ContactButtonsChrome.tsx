'use client';

import { usePathname } from 'next/navigation';
import { ContactButtons, type SiteData as RendererSiteData } from '@hillbombcreations/site-renderer';
import type { ContactButtonsSiteData } from '@/lib/contactButtons';

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
  return <ContactButtons siteData={siteData as RendererSiteData} currentPath={pathname} />;
}
