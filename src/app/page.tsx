import Head from 'next/head';
import Navbar from '@/components/Navigation/Navbar';
import {
    getHeroSectionData,
    getSiteData
} from '@/lib/api/landing';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import EmailListComponent from '@/components/EmailListComponent';
import HeroSection from '@/components/LandingPage/HeroSection';

const Index = async () => {
    const heroSectionData = await getHeroSectionData();
    const siteData = await getSiteData();
    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.surface }}>
            <Head>
                <title>Vivreal Headless CMS | Modern Content Management Platform</title>
                <meta name='description' content='Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms.' />
                <link rel='canonical' href={'https://www.vivreal.io'} />
            </Head>
            <Navbar />
            <EmailListComponent />
            <HeroSection />
            <CTASection />
            <Footer />
        </div>
    );
};

export default Index;

export const generateMetadata = async () => {
  return {
    title: "Vivreal CMS - Powerful Content Management Without the Cost",
    description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
    openGraph: {
      title: "Vivreal CMS - Powerful Content Management Without the Cost",
      description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
      url: "https://vivreal.io/",
      images:  [
        {
            url: new URL("/heroImage.png", "https://vivreal.io"),
            width: 1200,
            height: 630,
            alt: "Vivreal CMS - Powerful Content Management Without the Cost",
        },
    ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal CMS - Powerful Content Management Without the Cost",
      description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
      images: [new URL("/heroImage.png", "https://vivreal.io")]
    },
  };
}