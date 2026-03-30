import type { ElementType, ReactNode } from 'react';
export interface SiteRendererContextValue {
    LinkComponent: ElementType;
    ImageComponent: ElementType;
    previewMode: boolean;
}
export declare function useSiteRenderer(): SiteRendererContextValue;
export interface SiteRendererProviderProps extends Partial<SiteRendererContextValue> {
    children: ReactNode;
}
export declare function SiteRendererProvider({ LinkComponent, ImageComponent, previewMode, children, }: SiteRendererProviderProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=SiteRendererContext.d.ts.map