'use client';

import SolutionsSection from './index';
import { SolutionsSectionProps } from '@/types/LandingPage/SolutionsSection';

const SolutionsSectionWrapper = (props: SolutionsSectionProps) => {
    return <SolutionsSection { ...props } />;
};

export default SolutionsSectionWrapper;