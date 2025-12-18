/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Head from 'next/head';
import { useSiteData } from '@/contexts/SiteDataContext';
import { OurOfferings, ProductShowcase } from '@/types/Landing';

import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/Landing/HeroSection';
import ProductShowcaseComponent from '@/components/Landing/ProductShowcase';
import OurOfferingsComponent from '@/components/Landing/OurOfferings';
import ContactSection from '@/components/Landing/ContactUs';
export const dynamic = "force-dynamic"

type LandingWrapperProps = {
    landingSections: Record<string, any>;
    productShowcase: ProductShowcase[];
    ourOfferings: OurOfferings[];
};

const LandingWrapper = ({ landingSections, productShowcase, ourOfferings}: LandingWrapperProps) => {
    const siteData = useSiteData();

    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.siteDetails?.surface }}>
            <Head>
                <title>{siteData?.businessInfo?.name}</title>
                <meta name='description' content={siteData?.businessInfo?.name} />
                <link rel='canonical' href={siteData?.domainName} />
            </Head>
            
            <HeroSection heroSection={landingSections.heroSection} />
            <ProductShowcaseComponent productShowcase={productShowcase} productShowcaseSection={landingSections.productShowcase}/>
            <OurOfferingsComponent ourOfferings={ourOfferings} />
            <ContactSection contactSection={landingSections.contactUs}/>
            <CTASection />
        </div>
    );
};

export default LandingWrapper;