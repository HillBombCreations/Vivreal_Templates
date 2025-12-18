'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster as AppToaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { useEffect } from 'react';
import { SiteData } from '@/types/SiteData';
import '@/styles/globals.css';
import { SiteDataProvider } from '@/contexts/SiteDataContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProductsProvider } from '@/contexts/ProductsContext';
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

    return (
    <SiteDataProvider siteData={siteData}>
        <CartProvider>
            <ProductsProvider>
                <QueryClientProvider client={queryClient}>
                    <TooltipProvider>
                        <AppToaster />
                        <Sonner />
                        {children}
                    </TooltipProvider>
                </QueryClientProvider>
            </ProductsProvider>
        </CartProvider>
    </SiteDataProvider>
    );
};

export default Providers;