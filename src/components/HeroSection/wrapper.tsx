'use client';

import HeroSection from './index';
import { HeroSectionProps } from '@/types/LandingPage/HeroSection';

const HeroSectionWrapper = (props: HeroSectionProps) => {
    return <HeroSection { ...props } />;
};

export default HeroSectionWrapper;