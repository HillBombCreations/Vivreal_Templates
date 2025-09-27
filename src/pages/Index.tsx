import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import CTASection from '@/components/CTASection';
import CarouselSection from '@/components/CarouselSection';
import CardSection from '@/components/CardSection';
import CarouselSection2 from '@/components/CarouselSection2';
import Footer from '@/components/Footer';
// import FeaturesSection from '@/components/FeaturesSection';
// import HeroEditorDemo from '@/components/HeroEditorDemo';
// import SolutionsSection from '@/components/SolutionsSection';
// import FeaturesGifSection from '@/components/FeaturesGifSection';
// import WhatWeDoSection from '@/components/WhatWeDoSection';
// import TeamSync from '@/components/TeamSync';
import { Helmet } from 'react-helmet';

const Index = () => {
  const [isMobile, setIsMobile] = useState(false);

  // Smooth scroll behavior for anchor links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a[href^='#']");
      
      if (anchor) {
        e.preventDefault();
        const targetId = anchor.getAttribute('href');
        if (targetId && targetId !== '#') {
          const targetElement = document.querySelector(targetId);
          if (targetElement) {
            window.scrollTo({
              top: targetElement.getBoundingClientRect().top + window.scrollY - 100,
              behavior: 'smooth'
            });
          }
        }
      }
    };

    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className='min-h-screen bg-background overflow-x-hidden'>
      <Helmet>
        <title>Vivreal Headless CMS | Modern Content Management Platform</title>
        <meta name='description' content='Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms.' />
        <link rel='canonical' href={'https://www.vivreal.io'} />
      </Helmet>
      <Navbar />
      <main>
        <HeroSection page="landing" />
        <CarouselSection page="landing" />
        <CarouselSection2 />
        <CardSection />

        {/* {
          !isMobile && <HeroEditorDemo />
        } */}
        
        {/* <FeaturesGifSection /> */}
        {/* <TeamSync />
        <SolutionsSection />
        
        <FeaturesSection />
        <WhatWeDoSection /> */}
        {/* <TestimonialsSection /> */}
        <CTASection page='Landing'/>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
