'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const SOCIAL_PLATFORM_URLS = {
    twitter: 'https://twitter.com/',
    x: 'https://x.com/',
    instagram: 'https://instagram.com/',
    facebook: 'https://facebook.com/',
    linkedin: 'https://linkedin.com/in/',
    tiktok: 'https://tiktok.com/@',
    youtube: 'https://youtube.com/',
    pinterest: 'https://pinterest.com/',
};
function resolveUrl(link) {
    if (link.link.startsWith('http'))
        return link.link;
    const base = SOCIAL_PLATFORM_URLS[link.type.toLowerCase()];
    return base ? `${base}${link.link}` : `https://${link.link}`;
}
export default function FooterView({ siteName, logoUrl, email, navItems, socialLinks = [], accentColor, LinkComponent = 'a', ImageComponent = 'img', }) {
    return (_jsxs("footer", { style: {
            background: 'color-mix(in srgb, var(--secondary) 15%, var(--surface))',
            borderTop: '1px solid var(--border)',
            paddingTop: '48px',
            paddingBottom: '0',
        }, children: [_jsx("div", { className: "content-grid", children: _jsxs("div", { style: {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(1, 1fr)',
                        gap: '40px',
                        paddingBottom: '40px',
                    }, className: "footer-grid", children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '12px' }, children: [_jsxs(LinkComponent, { href: "/", style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        textDecoration: 'none',
                                        width: 'fit-content',
                                    }, children: [logoUrl && (_jsx(ImageComponent, { src: logoUrl, alt: `${siteName} logo`, width: 28, height: 28, style: {
                                                width: '28px',
                                                height: '28px',
                                                objectFit: 'contain',
                                                borderRadius: '4px',
                                            } })), _jsx("span", { style: {
                                                fontWeight: 700,
                                                fontSize: '1.0625rem',
                                                color: accentColor ?? 'var(--text-primary)',
                                            }, children: siteName })] }), email && (_jsx("a", { href: `mailto:${email}`, style: {
                                        fontSize: '0.875rem',
                                        color: 'var(--text-secondary)',
                                        textDecoration: 'none',
                                    }, children: email }))] }), navItems.length > 0 && (_jsxs("div", { children: [_jsx("p", { style: {
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '12px',
                                    }, children: "Pages" }), _jsx("ul", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }, children: navItems.map((item) => (_jsx("li", { children: _jsx(LinkComponent, { href: item.path, style: {
                                                fontSize: '0.9375rem',
                                                color: 'var(--text-primary)',
                                                textDecoration: 'none',
                                                opacity: 0.85,
                                                transition: 'opacity 0.15s',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.opacity = '1';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.opacity = '0.85';
                                            }, children: item.name }) }, item.path))) })] })), socialLinks.length > 0 && (_jsxs("div", { children: [_jsx("p", { style: {
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '12px',
                                    }, children: "Follow Us" }), _jsx("ul", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }, children: socialLinks.map((link) => (_jsx("li", { children: _jsx("a", { href: resolveUrl(link), target: "_blank", rel: "noopener noreferrer", style: {
                                                fontSize: '0.9375rem',
                                                color: accentColor ?? 'var(--text-primary)',
                                                textDecoration: 'none',
                                                opacity: 0.85,
                                                transition: 'opacity 0.15s',
                                                textTransform: 'capitalize',
                                            }, onMouseEnter: (e) => {
                                                e.currentTarget.style.opacity = '1';
                                            }, onMouseLeave: (e) => {
                                                e.currentTarget.style.opacity = '0.85';
                                            }, children: link.type }) }, link.type))) })] }))] }) }), _jsx("div", { style: {
                    borderTop: '1px solid var(--border)',
                }, children: _jsxs("div", { className: "content-grid", style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '16px',
                        paddingBottom: '16px',
                        flexWrap: 'wrap',
                        gap: '8px',
                    }, children: [_jsxs("span", { style: { fontSize: '0.8125rem', color: 'var(--text-secondary)' }, children: ["\u00A9 ", new Date().getFullYear(), " ", siteName] }), _jsx("a", { href: "https://vivreal.io", target: "_blank", rel: "noopener noreferrer", style: {
                                fontSize: '0.8125rem',
                                color: 'var(--text-secondary)',
                                textDecoration: 'none',
                                opacity: 0.7,
                                transition: 'opacity 0.15s',
                            }, onMouseEnter: (e) => {
                                e.currentTarget.style.opacity = '1';
                            }, onMouseLeave: (e) => {
                                e.currentTarget.style.opacity = '0.7';
                            }, children: "Powered by Vivreal" })] }) }), _jsx("style", { children: `
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      ` })] }));
}
