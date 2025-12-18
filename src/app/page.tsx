/* eslint-disable @typescript-eslint/no-explicit-any */
import Head from 'next/head';
import Navbar from '@/components/Navigation/Navbar';
import {
    getSiteData
} from '@/lib/api/siteData';
import {
  getLandingSections,
  getOurOfferings,
  getProductShowcase
} from '@/lib/api/Landing';
import { OurOfferings, ProductShowcase } from '@/types/Landing'
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/Landing/HeroSection';
import ProductShowcaseComponent from '@/components/Landing/ProductShowcase';
import OurOfferingsComponent from '@/components/Landing/OurOfferings';
import ContactSection from '@/components/Landing/ContactUs';
export const dynamic = "force-dynamic"

const Index = async () => {
    const siteData = await getSiteData();
    const landingSections = await getLandingSections() as Record<string, any>;
    const productShowcase = await getProductShowcase() as ProductShowcase[];
    const ourOfferings = await getOurOfferings() as OurOfferings[];

    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.surface }}>
            <Head>
                <title>{siteData?.businessInfo?.name}</title>
                <meta name='description' content={siteData?.businessInfo?.name} />
                <link rel='canonical' href={siteData?.domainName} />
            </Head>
            <Navbar />
            <HeroSection heroSection={landingSections.heroSection} />
            <ProductShowcaseComponent productShowcase={productShowcase} productShowcaseSection={landingSections.productShowcase}/>
            <OurOfferingsComponent ourOfferings={ourOfferings} />
            <ContactSection contactSection={landingSections.contactUs}/>
            <CTASection />
            <Footer />
        </div>
    );
};

export default Index;

// TODO: fix image url to be from cms data
export const generateMetadata = async () => {
  const siteData = await getSiteData();
  return {
    title: siteData?.businessInfo?.name,
    description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
    openGraph: {
      title: siteData?.businessInfo?.name,
      description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
      url: siteData?.domainName,
      images:  [
        {
            url: new URL("/heroImage.png", "https://comedycollectivechi.com"),
            width: 1200,
            height: 630,
            alt: "The Comedy Collective Logo",
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: siteData?.businessInfo?.name,
      description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
      images: [new URL("/heroImage.png", "https://comedycollectivechi.com")]
    },
  };
}