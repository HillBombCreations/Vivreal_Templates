'use client';

import { ReactNode, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as AppToaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { useEffect } from 'react';
import { SiteData } from '@/types/SiteData';
import '@/styles/globals.css';
import { SiteDataProvider } from '@/contexts/SiteDataContext';

type WindowWithClarity = Window & { clarity?: (...args: unknown[]) => void };

const queryClient = new QueryClient();

const Providers = ({
    children,
    siteData,
}: {
    children: ReactNode;
    siteData: SiteData;
}) => {
    const injectClarity = () => {
        if ((window as WindowWithClarity).clarity || document.getElementById('clarity-script')) return;

        const script = document.createElement("script");
        script.id = 'clarity-script';
        script.innerHTML = `
            (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/pgpex8klud?ref=bwt";
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "pgpex8klud");
        `;
        document.head.appendChild(script);
    };

    const handleAccept = useCallback(() => {
        injectClarity();
        window.gtag?.('consent', 'update', {
            analytics_storage: 'granted',
        });
    }, []);

    const handleReject = useCallback(() => {
        // setConsentGiven(false);
    }, []);

    useEffect(() => {
        if (siteData?.primary) {
            Object.entries(siteData).forEach(([key, value]) => {
                if (typeof value === 'string') {
                    document.documentElement.style.setProperty(`--${key}`, value);
                }
            });
        }
    }, [siteData]);

    return (
    <SiteDataProvider siteData={siteData}>
        <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <AppToaster />
            <Sonner />
            {children}
        </TooltipProvider>
        </QueryClientProvider>
    </SiteDataProvider>
    );
};

export default Providers;