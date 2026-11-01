'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as AppToaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { SiteData } from '@/types/SiteData';
import { themeVarStyle } from '@/lib/theme/themeVarStyle';
import '@/styles/globals.css';
import { SiteDataProvider } from '@/contexts/SiteDataContext';
import { CartProvider } from '@/contexts/CartContext';
import CartDialogWrapper from './CartDialogWrapper';
import { NextSiteRendererProvider } from '@hillbombcreations/site-renderer';
import { recordGoal, recordLinkTap } from '@/lib/siteEvents';
import { subscribeUser } from '@/lib/api/subscribe/client';
import { resolveSubscribersCollectionId } from '@/lib/subscribe/subscribersList';
import { requestDeliveryQuote } from '@/lib/delivery/quoteClient';
import { trackLeadConversion } from '@/lib/analytics';
import { pagesNeedCart, type CartGatePage } from '@/lib/payments';
import { rendererCommerce } from '@/lib/rendererCommerce';

const queryClient = new QueryClient();

const Providers = ({
    children,
    siteData,
    vivrealOwnSite,
}: {
    children: ReactNode;
    siteData: SiteData;
    /**
     * `isVivrealOwnSite(process.env.SITE_ID)` from the root layout. Forwarded
     * to `trackLeadConversion` below, which is the only thing in here that
     * reads Vivreal's consent state.
     */
    vivrealOwnSite: boolean;
}) => {

    useEffect(() => {
        // Owner find 3 (renderer 1.90.0): the SAME builder the root layout
        // server-renders onto <html>, so after load the root carries exactly
        // what the first paint did. This used to stamp EVERY string field of
        // siteData as `--<key>` (`--favicon`, a data URI, `--chrome`,
        // `--canonicalUrl` and the rest, none of which anything reads) plus the
        // accent rule from a Templates copy; the keys something reads are all on
        // the builder's whitelist, proved over the fleet by themeParity.test.ts.
        if (siteData?.primary) {
            const themeStyle = themeVarStyle(siteData as unknown as Record<string, unknown>) ?? {}; // SiteData is a closed interface; the builder reads it as a plain record
            for (const [property, value] of Object.entries(themeStyle)) {
                document.documentElement.style.setProperty(property, String(value));
            }
        }
        // Typography is an object. Map the Studio's Branding preset onto the
        // font CSS vars consumed by globals.css (body / .font-brand) and the
        // renderer's headings. Its `monoFamily` reaches `--font-mono` through
        // the builder above (resolveMonoFamily), not here.
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
        // Motion-signature preset (template-identity kits §6). Same stamp
        // pattern as styleVariant: the renderer's published content-grid.css
        // scopes `--motion-*` token overrides to [data-motion-preset='<id>'].
        // Absent ⇒ removed ⇒ the :root defaults (legacy Wave-F motion).
        const motionPreset = (siteData as { motionPreset?: string }).motionPreset;
        if (motionPreset) {
            document.documentElement.setAttribute('data-motion-preset', motionPreset);
        } else {
            document.documentElement.removeAttribute('data-motion-preset');
        }
    }, [siteData]);

    const pages = siteData.pageConfigs ?? [];
    // Cart mount gate — extracted to lib/payments.ts (pagesNeedCart) so it is
    // unit-testable. Crucially it walks bindings at ANY depth: a coordinated
    // Products group carries its payments binding on the GRID CHILD
    // (config.children[].config.bindings), which the old inline scan missed —
    // the cart never mounted on storefront-unit pages and every add-to-cart
    // silently no-opped (first live Square E2E).
    const hasProducts = pagesNeedCart(pages as CartGatePage[]);

    // S2/OD#3: pass the Maps API key so keyed Google Maps Embed API URLs
    // are used in the schedule page's map view. Falls back to the keyless embed
    // when the env var is not configured — nothing breaks.
    // `mapsApiKey` is added to `NextSiteRendererProvider` in the renderer working
    // tree but not yet in the installed 1.17.0 package. Cast required until the
    // package is bumped. Remove the cast + eslint-disable when bumped.
    // Inline email-capture (hero #4 / footer #9): resolve the site's subscribers
    // list once and inject a subscribe handler so hero + footer land in the
    // SAME list as the popup (the same resolver EmailPopup uses). No list ⇒ ''
    // ⇒ subscribeUser refuses with no request (N-C6).
    const subscribersCollectionId = resolveSubscribersCollectionId(siteData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NextProvider = NextSiteRendererProvider as any;
    const content = (
        <NextProvider
            mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            // Storefront Phase 0.2: opts every storefront into the purchase rule.
            // F-C19: plus the shop's paused or moving state (see lib/rendererCommerce.ts).
            commerce={rendererCommerce(siteData)}
            onSubscribe={async (email: string, _source?: string, fields?: Record<string, string>) => {
                const ok = await subscribeUser(email, subscribersCollectionId, fields);
                // C5, the one conversion event. This comment used to say it
                // self-gated on "the vivreal.io apex, so it is inert on every
                // customer site". It was not inert: the apex gate matched every
                // customer site served from a vivreal.io subdomain, and
                // `window.gtag` there is the CUSTOMER's GA4 tag, so a visitor
                // who accepted Vivreal's banner on a customer's site fired
                // Vivreal's lead event into the customer's analytics. Now gated
                // on the site id. Only on SUCCESS: a failed capture is not a
                // lead.
                if (ok)
                    trackLeadConversion({ vivrealOwnSite, method: _source || 'inline' });
                return ok;
            }}
            // The delivery coverage check. `DeliveryCheck` reads this off the
            // renderer context and DISABLES ITSELF when it is absent, so
            // without this line the block ships a heading, a greyed-out ZIP
            // box and a dead button on every live site, and the proxy plus the
            // whole VR_Client_API endpoint behind it are unreachable from the
            // product. Passed by reference, not wrapped: there is nothing for
            // this layer to add, and an inline arrow here would be a second
            // place for the failure contract to drift.
            //
            // Passed UNCONDITIONALLY. A site with no API key gets a 503 from
            // the proxy, which `requestDeliveryQuote` turns into "could not
            // check right now", which is an honest degrade. Gating the prop on config
            // instead would hand the owner the disabled control, which reads
            // as the feature being broken rather than not yet set up.
            //
            // Needs the renderer to forward `onDeliveryQuote` through
            // `NextSiteRendererProvider` (1.64.0, unpublished at the time of
            // writing). Until that lands the prop is accepted and dropped, and
            // the block stays in exactly the disabled state it is in today.
            onDeliveryQuote={requestDeliveryQuote}
            // Owner ideas F5 (D32): a tap on a link page button sends one `lt`
            // beacon, through the page view's own gate (lib/siteEvents.ts).
            onLinkTap={recordLinkTap}
            // Next release 2026-11 (N2): a contact form message the server
            // accepted sends one `gl` result beacon, through the same gate.
            onGoal={recordGoal}
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