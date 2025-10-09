'use client';

import { useEffect, useState } from 'react';
import HeroEditorDemo from './index';
import { HeroSectionProps } from '@/types/LandingPage/HeroSection';

const HeroEditorDemoWrapper = (props: HeroSectionProps) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return !isMobile ? <HeroEditorDemo {...props} /> : null;
};

export default HeroEditorDemoWrapper;