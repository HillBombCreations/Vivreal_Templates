'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as AppToaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { SiteData } from '@/types/SiteData';
import { readableAccentOnWhite } from '@/lib/theme/readableAccent';
import '@/styles/globals.css';
import { SiteDataProvider } from '@/contexts/SiteDataContext';
import { CartProvider } from '@/contexts/CartContext';
import CartDialogWrapper from './CartDialogWrapper';
import { NextSiteRendererProvider } from '@hillbombcreations/site-renderer';
import { subscribeUser } from '@/lib/api/subscribe/client';

const queryClient = new QueryClient();

const Providers = ({
    children,
    siteData,
}: {
    children: ReactNode;
    siteData: SiteData;
}) => {

    useEffect(() => {
        if (siteData?.primary) {
            Object.entries(siteData).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    document.documentElement.style.setProperty(`--${key}`, value);
                }
            });
            // Derived token (mirrors layout.tsx SSR emission): the AA-on-white
            // accent variant for rich-text links / accent-as-text surfaces.
            const readable = readableAccentOnWhite(siteData.primary);
            if (readable) {
                document.documentElement.style.setProperty('--accent-readable', readable);
            }
        }
        // Typography is an object (skipped by the string loop above) — map the
        // Studio's Branding preset onto the font CSS vars consumed by
        // globals.css (body / .font-brand) and the renderer's headings.
        const typography = (siteData as { typography?: { displayFamily?: string; bodyFamily?: string } }).typography;
        if (typography?.displayFamily) {
            document.documentElement.style.setProperty('--font-display', typography.displayFamily);
        }
        if (typography?.bodyFamily) {
            document.documentElement.style.setProperty('--font-body', typography.bodyFamily);
        }
        // Per-site visual-density override (styling parity). When the site opts into
        // 'compact', stamp the root so globals.css can scope the smaller heading
        // scale + lighter hero CTA to THIS site only. Absent ⇒ removed ⇒ default look.
        const styleVariant = (siteData as { styleVariant?: string }).styleVariant;
        if (styleVariant) {
            document.documentElement.setAttribute('data-style-variant', styleVariant);
        } else {
            document.documentElement.removeAttribute('data-style-variant');
        }
    }, [siteData]);

    const pages = siteData.pageConfigs ?? [];
    const hasProducts = pages.some((p) => p.format === 'products') ||
        pages.some((p) =>
            (p.integrations ?? []).some(
                (i) => (i.type ?? i.name ?? '').toLowerCase() === 'stripe'
            )
        ) ||
        // SP-4: a page may record its stripe integration only in a block binding
        // (after the legacy integrations[] array is stripped). Detect that too so
        // the cart stays wired.
        pages.some((p) =>
            (p.blocks ?? []).some((b) =>
                (b?.config?.bindings ?? []).some(
                    (bd) => (bd?.integrationProvider ?? '').toLowerCase() === 'stripe'
                )
            )
        );

    // S2/OD#3: pass the Maps API key so keyed Google Maps Embed API URLs
    // are used in the schedule page's map view. Falls back to the keyless embed
    // when the env var is not configured — nothing breaks.
    // `mapsApiKey` is added to `NextSiteRendererProvider` in the renderer working
    // tree but not yet in the installed 1.17.0 package. Cast required until the
    // package is bumped. Remove the cast + eslint-disable when bumped.
    // Inline email-capture (hero #4 / footer #9): resolve the site's subscribers
    // collection once and inject a subscribe handler so hero + footer land in the
    // SAME list as the popup (mirrors EmailPopup's collectionId resolution). No
    // subscribers collection ⇒ '' ⇒ subscribeUser is a no-op.
    const subPage = pages.find((p) => p.format === 'subscribers');
    const subscribersCollectionId =
        subPage?.blocks?.find(
            (b) => b?.type?.kind === 'page-template' && b?.type?.dispatchId === 'subscribe',
        )?.config?.bindings?.find((bd) => bd.collectionId)?.collectionId ??
        subPage?.collectionId ??
        '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NextProvider = NextSiteRendererProvider as any;
    const content = (
        <NextProvider
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            onSubscribe={async (email: string, _source?: string, fields?: Record<string, string>) =>
                subscribeUser(email, subscribersCollectionId, fields)}
        >
        <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <AppToaster />
            <Sonner />
            {children}
        </TooltipProvider>
        </QueryClientProvider>
        </NextProvider>
    );

    return (
    <SiteDataProvider siteData={siteData}>
        {hasProducts ? (
            <CartProvider>
                {content}
                <CartDialogWrapper />
            </CartProvider>
        ) : content}
    </SiteDataProvider>
    );
};

export default Providers;