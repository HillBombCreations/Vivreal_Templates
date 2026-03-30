'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function NavbarView({ siteName, logoUrl, navItems, accentColor, LinkComponent = 'a', ImageComponent = 'img', }) {
    return (_jsxs("header", { style: {
            position: 'sticky',
            top: 0,
            zIndex: 50,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border)',
        }, children: [_jsxs("div", { className: "content-grid", style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '64px',
                    paddingTop: '0',
                    paddingBottom: '0',
                }, children: [_jsxs(LinkComponent, { href: "/", style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                        }, children: [logoUrl && (_jsx(ImageComponent, { src: logoUrl, alt: `${siteName} logo`, width: 32, height: 32, style: { width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' } })), _jsx("span", { style: {
                                    fontWeight: 700,
                                    fontSize: '1.125rem',
                                    color: accentColor ?? 'var(--text-primary)',
                                    letterSpacing: '-0.01em',
                                }, children: siteName })] }), navItems.length > 0 && (_jsx("nav", { style: {
                            display: 'none',
                            alignItems: 'center',
                            gap: '8px',
                        }, className: "navbar-desktop-nav", children: navItems.map((item) => (_jsx(LinkComponent, { href: item.path, style: {
                                padding: '6px 14px',
                                borderRadius: '6px',
                                fontSize: '0.9375rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                transition: 'background-color 0.15s, color 0.15s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.backgroundColor = accentColor
                                    ? `${accentColor}18`
                                    : 'color-mix(in srgb, var(--secondary) 10%, transparent)';
                                e.currentTarget.style.color = accentColor ?? 'var(--text-primary)';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }, children: item.name }, item.path))) }))] }), _jsx("style", { children: `
        @media (min-width: 768px) {
          .navbar-desktop-nav {
            display: flex !important;
          }
        }
      ` })] }));
}
