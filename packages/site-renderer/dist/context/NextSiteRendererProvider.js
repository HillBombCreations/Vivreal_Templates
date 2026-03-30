'use client';
import { jsx as _jsx } from "react/jsx-runtime";
import Link from 'next/link';
import Image from 'next/image';
import { SiteRendererProvider } from './SiteRendererContext';
export function NextSiteRendererProvider({ previewMode = false, children, }) {
    return (_jsx(SiteRendererProvider, { LinkComponent: Link, ImageComponent: Image, previewMode: previewMode, children: children }));
}
