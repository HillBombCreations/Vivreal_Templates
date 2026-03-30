'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight } from 'lucide-react';
export default function CTAView({ heading = 'Ready to get started?', subheading, label = 'Get Started', linkTo = '/', accentColor = '#6366f1', LinkComponent = 'a', }) {
    return (_jsx("section", { className: "content-grid", style: { paddingTop: '64px', paddingBottom: '64px' }, children: _jsxs("div", { style: {
                backgroundColor: accentColor,
                borderRadius: '16px',
                padding: '56px 40px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '20px',
            }, children: [_jsx("h2", { style: {
                        margin: 0,
                        fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                        fontWeight: 800,
                        color: '#ffffff',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.2,
                    }, children: heading }), subheading && (_jsx("p", { style: {
                        margin: 0,
                        fontSize: '1.125rem',
                        color: 'rgba(255, 255, 255, 0.8)',
                        maxWidth: '520px',
                        lineHeight: 1.6,
                    }, children: subheading })), _jsxs(LinkComponent, { href: linkTo, style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '4px',
                        padding: '12px 28px',
                        backgroundColor: '#ffffff',
                        color: accentColor,
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '1rem',
                        textDecoration: 'none',
                        transition: 'transform 0.15s, box-shadow 0.15s',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                    }, onMouseEnter: (e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.18)';
                    }, onMouseLeave: (e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
                    }, children: [label, _jsx(ArrowRight, { size: 18, strokeWidth: 2.5 })] })] }) }));
}
