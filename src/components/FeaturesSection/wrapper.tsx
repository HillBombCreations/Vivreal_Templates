'use client';

import { FeaturesSectionProps } from '@/types/LandingPage/FeaturesSection';
import FeaturesSection from './index';

const FeaturesSectionWrapper = (props: FeaturesSectionProps) => {
    return <FeaturesSection { ...props } />;
};

export default FeaturesSectionWrapper;