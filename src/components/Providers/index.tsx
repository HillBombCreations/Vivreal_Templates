'use client';

import { ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as AppToaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { SiteData } from '@/types/SiteData';
import '@/styles/globals.css';
import { SiteDataProvider } from '@/contexts/SiteDataContext';
import { CartProvider } from '@/contexts/CartContext';
import CartDialogWrapper from './CartDialogWrapper';

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
        }
    }, [siteData]);

    const pageList = (siteData.pageConfigs ?? []) as Array<{ format?: string }>;
    const hasProducts = pageList.some((p) => p.format === 'products');

    const content = (
        <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <AppToaster />
            <Sonner />
            {children}
        </TooltipProvider>
        </QueryClientProvider>
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