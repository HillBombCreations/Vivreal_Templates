'use client';

import LandingPage from './index';
import { useSiteData } from '@/contexts/SiteDataContext';
import { LandingPageProps } from '@/types/LandingPage';

const LandingPageWrapper = (props: LandingPageProps) => {
    const siteData = useSiteData();
    const propData = {...props, siteData };
    
    return <LandingPage { ...propData } />;
};

export default LandingPageWrapper;