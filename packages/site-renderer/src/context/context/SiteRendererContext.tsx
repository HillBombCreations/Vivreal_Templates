'use client';

import { createContext, useContext } from 'react';
import type { ElementType, ReactNode } from 'react';

export interface SiteRendererContextValue {
  LinkComponent: ElementType;
  ImageComponent: ElementType;
  previewMode: boolean;
}

const defaults: SiteRendererContextValue = {
  LinkComponent: 'a',
  ImageComponent: 'img',
  previewMode: false,
};

const SiteRendererContext = createContext<SiteRendererContextValue>(defaults);

export function useSiteRenderer(): SiteRendererContextValue {
  return useContext(SiteRendererContext);
}

export interface SiteRendererProviderProps extends Partial<SiteRendererContextValue> {
  children: ReactNode;
}

export function SiteRendererProvider({
  LinkComponent = 'a',
  ImageComponent = 'img',
  previewMode = false,
  children,
}: SiteRendererProviderProps) {
  return (
    <SiteRendererContext.Provider value={{ LinkComponent, ImageComponent, previewMode }}>
      {children}
    </SiteRendererContext.Provider>
  );
}
