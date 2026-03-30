'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { useSiteRenderer } from '../context/SiteRendererContext';
export default function NavbarView({ siteName, logoUrl, navItems, accentColor, pageConfigs, }) {
    const { LinkComponent, ImageComponent } = useSiteRenderer();
    const [mobileOpen, setMobileOpen] = useState(false);
    const primary = accentColor ?? '#1a1a2e';
    // Find the review/form page for the CTA button
    const reviewPage = pageConfigs?.find((p) => p.format === 'form');
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "fixed top-0 left-0 right-0 z-50 pt-4 pb-1 md:pt-5 bg-white/90 backdrop-blur-sm", children: _jsxs("div", { className: "w-full px-4", children: [_jsxs("div", { className: "flex md:hidden items-center justify-between", children: [_jsxs(LinkComponent, { href: "/", onClick: (e) => e.preventDefault(), className: "flex-1 inline-flex items-center gap-2", children: [logoUrl && (_jsx(ImageComponent, { src: logoUrl, alt: siteName || 'Logo', width: 48, height: 48, className: "inline-block object-contain", style: { width: 48, height: 48, objectFit: 'contain' } })), _jsx("span", { className: "text-2xl font-semibold leading-none", style: { color: 'var(--text-primary, #0b1220)' }, children: siteName })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { className: "p-2 rounded-lg hover:bg-black/5 transition", "aria-label": "Cart", children: _jsx(ShoppingCart, { className: "h-5 w-5", style: { color: 'var(--text-primary, #333)' } }) }), _jsx("button", { className: "p-2 rounded-lg hover:bg-black/5 transition", onClick: () => setMobileOpen(!mobileOpen), "aria-label": "Menu", children: mobileOpen ? _jsx(X, { className: "w-6 h-6" }) : _jsx(Menu, { className: "w-6 h-6" }) })] })] }), _jsx("hr", { className: "md:hidden mt-1 border-black/10" }), _jsxs("div", { className: "hidden md:flex items-center relative justify-between", children: [_jsx("div", { className: "flex items-center gap-2.5", children: _jsxs(LinkComponent, { href: "/", onClick: (e) => e.preventDefault(), className: "flex items-center gap-2.5", children: [logoUrl && (_jsx(ImageComponent, { src: logoUrl, alt: siteName || 'Logo', width: 40, height: 40, className: "object-contain", style: { width: 40, height: 40, objectFit: 'contain' } })), _jsx("span", { className: "text-xl font-semibold text-gray-900", children: siteName })] }) }), _jsx("nav", { className: "absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1", children: navItems.map((item) => (_jsx(LinkComponent, { href: item.path, onClick: (e) => e.preventDefault(), className: "nav-link text-base font-medium px-3 py-2 text-gray-800 relative transition-colors hover:text-gray-900", children: item.label || item.name }, item.path))) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "p-2 rounded-lg hover:bg-black/5 transition relative", "aria-label": "Cart", children: _jsx(ShoppingCart, { className: "h-5 w-5", style: { color: 'var(--text-primary, #333)' } }) }), reviewPage && (_jsx(LinkComponent, { href: `/${reviewPage.slug}`, onClick: (e) => e.preventDefault(), className: "inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium border transition hover:opacity-90", style: { borderColor: primary, color: primary }, children: reviewPage.labels?.navLabel || 'Leave A Review' }))] })] })] }) }), mobileOpen && (_jsxs("div", { className: "fixed inset-0 z-[60] bg-white pt-20 px-6", children: [_jsx("button", { className: "absolute top-5 right-5 p-2 rounded-lg hover:bg-black/5", onClick: () => setMobileOpen(false), "aria-label": "Close menu", children: _jsx(X, { className: "w-6 h-6" }) }), _jsx("nav", { className: "flex flex-col gap-2", children: navItems.map((item) => (_jsx(LinkComponent, { href: item.path, className: "text-lg font-medium py-3 px-4 rounded-xl hover:bg-black/5 transition", style: { color: 'var(--text-primary, #0b1220)' }, onClick: (e) => { e.preventDefault(); setMobileOpen(false); }, children: item.label || item.name }, item.path))) })] })), _jsx("style", { children: `
        .nav-link {
          position: relative;
        }
        .nav-link::after {
          content: "";
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0%;
          height: 2px;
          background-color: ${primary};
          transition: width 0.3s ease;
        }
        .nav-link:hover::after {
          width: 100%;
        }
        .nav-link:hover {
          color: ${primary} !important;
        }
      ` }), _jsx("div", { style: { height: '72px' } })] }));
}
