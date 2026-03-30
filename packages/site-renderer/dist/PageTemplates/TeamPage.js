'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSiteRenderer } from '../context/SiteRendererContext';
const SOCIAL_CONFIG = {
    tiktok: {
        baseUrl: 'https://www.tiktok.com/',
        icon: (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72a8.2 8.2 0 0 0 4.76 1.52V6.69h-1z" }) })),
    },
    instagram: {
        baseUrl: 'https://www.instagram.com/',
        icon: (_jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "2", width: "20", height: "20", rx: "5", ry: "5" }), _jsx("path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" }), _jsx("line", { x1: "17.5", y1: "6.5", x2: "17.51", y2: "6.5" })] })),
    },
    x: {
        baseUrl: 'https://x.com/',
        icon: (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" }) })),
    },
    linkedin: {
        baseUrl: 'https://www.linkedin.com/in/',
        icon: (_jsx("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" }) })),
    },
};
function SocialIcons({ socialLinks }) {
    const links = Object.entries(socialLinks).filter(([, v]) => v);
    if (links.length === 0)
        return null;
    return (_jsx("div", { className: "flex gap-2 mb-2", children: links.map(([platform]) => {
            const config = SOCIAL_CONFIG[platform];
            if (!config)
                return null;
            return (_jsx("span", { className: "text-gray-400", children: config.icon }, platform));
        }) }));
}
const SkeletonCard = () => (_jsxs("div", { className: "\n      animate-pulse flex flex-col items-center text-center\n      p-8 bg-white dark:bg-gray-800\n      rounded-2xl shadow-md\n    ", children: [_jsx("div", { className: "w-40 h-40 mb-6 rounded-full bg-gray-200 dark:bg-gray-700" }), _jsx("div", { className: "h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" }), _jsx("div", { className: "h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-1" }), _jsx("div", { className: "h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" })] }));
export default function TeamPage({ members, labels, slug, siteData, }) {
    const { LinkComponent, ImageComponent, previewMode } = useSiteRenderer();
    const Img = ImageComponent ?? 'img';
    const A = previewMode ? 'span' : (LinkComponent ?? 'a');
    const siteName = siteData?.businessInfo?.name ??
        siteData?.name ??
        'our team';
    const accent = siteData?.primary ?? '#000';
    return (_jsxs("main", { className: "pt-24 md:pt-32", children: [_jsxs("section", { className: "mx-auto max-w-7xl px-6 mt-14", children: [_jsx("h1", { className: "text-4xl md:text-4xl font-bold text-center mb-8", children: labels.title }), _jsx("p", { className: "text-center max-w-2xl mx-auto mb-12", style: { color: siteData?.['text-primary'] }, children: labels.subtitle }), members.length === 0 ? (_jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-10", children: Array.from({ length: 6 }).map((_, idx) => (_jsx(SkeletonCard, {}, idx))) })) : (_jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-8", children: members.map((member, idx) => (_jsxs(A, { href: `/${slug}/${member.id}`, className: "\n                  group flex flex-row items-start gap-6\n                  p-6 border border-gray-200\n                  rounded-2xl hover:shadow-lg\n                  transition-all duration-300 no-underline\n                  bg-white\n                ", children: [_jsx("div", { className: "\n                    w-24 h-24 flex-shrink-0 rounded-full overflow-hidden\n                    ring-2 ring-gray-100\n                    group-hover:ring-primary/40 transition-all duration-300\n                  ", children: _jsx(Img, { src: member.imageUrl || member.image || '/logo.png', alt: member.name, width: 96, height: 96, sizes: "96px", className: "w-24 h-24 object-cover", style: { width: 96, height: 96, objectFit: 'cover' } }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900 mb-1", children: member.name }), member.socialLinks && (_jsx(SocialIcons, { socialLinks: member.socialLinks })), _jsx("div", { className: "text-sm text-gray-600 leading-relaxed line-clamp-4", 
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML: { __html: member.description } }), _jsx("span", { className: "inline-block mt-3 text-sm font-medium group-hover:underline", style: { color: accent }, children: "Read more" })] })] }, idx))) }))] }), _jsx("section", { className: "mt-24 mx-auto max-w-4xl text-center px-6", children: _jsxs("div", { className: "space-y-6 bg-secondary/50 px-6 py-12 rounded-xl", children: [_jsxs("h2", { className: "text-2xl md:text-3xl font-display font-bold", children: ["Thanks for taking the time to learn more about ", siteName, "!"] }), _jsx("p", { className: "text-sm max-w-xl mx-auto", style: {
                                color: siteData?.['text-secondary'],
                            }, children: "We're excited about the journey ahead and would love to have you with us!" })] }) })] }));
}
