import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from 'react';
const defaults = {
    LinkComponent: 'a',
    ImageComponent: 'img',
    previewMode: false,
};
const SiteRendererContext = createContext(defaults);
export function useSiteRenderer() {
    return useContext(SiteRendererContext);
}
export function SiteRendererProvider({ LinkComponent = 'a', ImageComponent = 'img', previewMode = false, children, }) {
    return (_jsx(SiteRendererContext.Provider, { value: { LinkComponent, ImageComponent, previewMode }, children: children }));
}
