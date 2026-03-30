'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SiteRendererProvider } from './SiteRendererContext';

interface NextSiteRendererProviderProps {
  previewMode?: boolean;
  children: ReactNode;
}

export function NextSiteRendererProvider({
  previewMode = false,
  children,
}: NextSiteRendererProviderProps) {
  return (
    <SiteRendererProvider
      LinkComponent={Link}
      ImageComponent={Image}
      previewMode={previewMode}
    >
      {children}
    </SiteRendererProvider>
  );
}
