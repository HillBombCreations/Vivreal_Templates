'use client';

import FeaturesGifSection from './index';
import { FeatureGifSectionProps } from '@/types/LandingPage/FeatureGifSection';

const FeatureGifSectionWrapper = (props: FeatureGifSectionProps) => {
    return <FeaturesGifSection { ...props } />;
};

export default FeatureGifSectionWrapper;