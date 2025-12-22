'use client';

import Head from 'next/head';
import { useSiteData } from '@/contexts/SiteDataContext';
import { LandingWrapperProps } from '@/types/Landing';

import CTASection from '@/components/CTASection';
import HeroSection from '@/components/Landing/HeroSection';
import ProductShowcaseComponent from '@/components/Landing/ProductShowcase';
import OurOfferingsComponent from '@/components/Landing/OurOfferings';
import ContactSection from '@/components/Landing/ContactUs';
export const dynamic = "force-dynamic"



const LandingWrapper = ({ landingSections, productShowcase, ourOfferings}: LandingWrapperProps) => {
    const siteData = useSiteData();

    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.siteDetails?.surface }}>
            <Head>
                <title>{siteData?.businessInfo?.name}</title>
                <meta name='description' content={siteData?.businessInfo?.name} />
                <link rel='canonical' href={siteData?.domainName} />
            </Head>
            
            <HeroSection heroSection={landingSections?.heroSection || null} />
            <ProductShowcaseComponent productShowcase={productShowcase} productShowcaseSection={landingSections?.productShowcase || null}/>
            <OurOfferingsComponent ourOfferings={ourOfferings} />
            <ContactSection contactSection={landingSections?.contactUs || null}/>
            <CTASection />
        </div>
    );
};

export default LandingWrapper;