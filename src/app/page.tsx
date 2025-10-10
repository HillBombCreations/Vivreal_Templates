import Head from 'next/head';
import Navbar from '@/components/Navigation/Navbar';
import { getArticles } from "@/lib/api/developers";
import {
    getHeroSectionData,
    getFeatureGifSectionData,
    getSolutionsSectionData,
    getWhatWeDoSectionData,
    getSiteData
} from '@/lib/api/landing';
import FeaturesGifSection from '@/components/LandingPage/FeatureGifSection';
import AboutSection from '@/components/LandingPage/AboutSection';
import ArticlesSection from '@/components/LandingPage/MediaSection';
import WhatWeDoSection from '@/components/LandingPage/WhatWeDoSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import HeroSection from '@/components/LandingPage/HeroSection';

const Index = async () => {
    const articleSectionData = await getArticles();
    const heroSectionData = await getHeroSectionData();
    const featureGifSectionData = await getFeatureGifSectionData();
    const solutionsSectionData = await getSolutionsSectionData();
    const whatWeDoSectionData = await getWhatWeDoSectionData();
    const siteData = await getSiteData();
    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.surface }}>
            <Head>
                <title>Vivreal Headless CMS | Modern Content Management Platform</title>
                <meta name='description' content='Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms.' />
                <link rel='canonical' href={'https://www.vivreal.io'} />
            </Head>
            <Navbar />
            <HeroSection />
            <FeaturesGifSection
            />
            <AboutSection
            />
            <ArticlesSection {...articleSectionData} />
            <WhatWeDoSection/>
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