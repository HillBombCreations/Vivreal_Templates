"use client";

import Navbar from '@/components/Navigation/Navbar';
import HeroSectionWrapper from '@/components/HeroSection/wrapper';
import CTASection from '@/components/CTASection';
import ArticlesSection from '@/components/ArticlesSection';
import Footer from '@/components/Footer';
import FeaturesSection from '@/components/FeaturesSection';
import SolutionsSection from '@/components/SolutionsSection';
import FeaturesGifSectionWrapper from '@/components/FeatureGifSection/wrapper';
import WhatWeDoSection from '@/components/WhatWeDoSection';
import HeroEditorDemoWrapper from '@/components/HeroEditorDemo/wrapper';
import TeamSyncWrapper from '@/components/TeamSync/wrapper';
import { LandingPageProps } from '@/types/LandingPage';
import Head from "next/head";

const Index = (props: LandingPageProps) => {
    const {
        articleSectionData,
        siteData,
        heroSectionData,
        teamSyncData,
        featureGifSectionData,
        solutionsSectionData,
        featuresSectionData,
        whatWeDoSectionData
    } = props;

    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.surface }}>
            <Head>
                <title>Vivreal Headless CMS | Modern Content Management Platform</title>
                <meta name='description' content='Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms.' />
                <link rel='canonical' href={'https://www.vivreal.io'} />
            </Head>
            <Navbar />
            <main>
                <HeroSectionWrapper
                    siteData={siteData}
                    heroSectionData={heroSectionData}
                    page="landing"
                />
                <HeroEditorDemoWrapper
                    siteData={siteData}
                    whatWeDoSectionData={whatWeDoSectionData}
                    featuresSection={featuresSectionData}
                    teamSyncData={teamSyncData}
                    featureGifSection={featureGifSectionData}
                    heroSectionData={heroSectionData}
                    solutionsSection={solutionsSectionData}
                    page="landing"
                />
                <FeaturesGifSectionWrapper
                    featureGifSection={featureGifSectionData}
                    siteData={siteData}
                />
                <TeamSyncWrapper
                    teamSyncData={teamSyncData}
                    siteData={siteData}
                />
                <SolutionsSection
                    solutionsSection={solutionsSectionData}
                    siteData={siteData}
                />
                <ArticlesSection
                    articleSectionData={articleSectionData}
                    siteData={siteData}
                />
                <FeaturesSection
                    featuresSection={featuresSectionData}
                    siteData={siteData}
                />
                <WhatWeDoSection
                    whatWeDoData={whatWeDoSectionData}
                    siteData={siteData}
                />
                <CTASection page='Landing'/>
            </main>
            <Footer />
        </div>
    );
};

export default Index;
