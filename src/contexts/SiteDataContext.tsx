'use client';

import { createContext, useContext } from 'react';
import { SiteData } from '@/types/SiteData';

const SiteDataContext = createContext<SiteData | null>(null);

export const SiteDataProvider = ({
  siteData,
  children
}: {
  siteData: SiteData;
  children: React.ReactNode;
}) => {
  return (
    <SiteDataContext.Provider value={siteData}>
      {children}
    </SiteDataContext.Provider>
  );
};

export const useSiteData = () => {
  const context = useContext(SiteDataContext);
  if (!context) {
    throw new Error('useSiteData must be used within a SiteDataProvider');
  }
  return context;
};