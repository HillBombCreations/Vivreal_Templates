'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { Calendar, MapPin, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSiteRenderer } from '../context/SiteRendererContext';
const SCROLL_SPEED = 0.3; // pixels per frame
/* ------------------------------------------------------------------ */
/*  Skeleton loaders (inlined from Vivreal_Templates)                 */
/* ------------------------------------------------------------------ */
const Skeleton = ({ className = '' }) => (_jsx("div", { className: `animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/40 ${className}`, "aria-hidden": "true" }));
const ShowSkeletonCard = ({ isMobile }) => (_jsxs("div", { className: `flex ${isMobile ? 'flex-col' : 'flex-row'} rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden`, role: "status", "aria-live": "polite", children: [_jsx("div", { className: `${isMobile ? 'w-full h-48 rounded-t-lg' : 'w-40 h-auto rounded-l-lg'} overflow-hidden`, children: _jsx(Skeleton, { className: `${isMobile ? 'h-48 w-full' : 'h-full min-h-[160px] w-40'}` }) }), _jsxs("div", { className: `${isMobile ? 'p-4' : 'flex-1 p-4'}`, children: [_jsx(Skeleton, { className: "h-6 w-2/3 mb-3" }), _jsx(Skeleton, { className: "h-4 w-full mb-2" }), _jsx(Skeleton, { className: "h-4 w-5/6 mb-2" }), _jsx(Skeleton, { className: "h-4 w-3/4 mb-4" }), _jsx(Skeleton, { className: `${isMobile ? 'w-full max-w-xs' : 'w-28'} h-9 rounded` })] })] }));
const PastShowSkeleton = () => (_jsx("div", { className: "relative flex-shrink-0 w-48 overflow-hidden rounded-xl shadow-sm", children: _jsx(Skeleton, { className: "w-full h-64" }) }));
/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
const HeroSectionShowcase = (props) => {
    const { siteData } = props;
    const { LinkComponent, ImageComponent, previewMode = false } = useSiteRenderer();
    // Resolve props — flat props take priority over prefetchedData
    const resolvedShows = props.shows ?? props.prefetchedData?.shows ?? [];
    const resolvedPartners = props.partners ?? props.prefetchedData?.partners ?? [];
    const resolvedLabels = props.labels ?? props.prefetchedData?.labels ?? { upcoming: 'Upcoming', past: 'Past' };
    const resolvedShowsSlug = props.showsSlug ?? props.prefetchedData?.showsSlug ?? 'shows';
    const Img = ImageComponent ?? 'img';
    const A = previewMode ? 'span' : (LinkComponent ?? 'a');
    const [isMobile, setIsMobile] = useState(false);
    const [upcomingShows, setUpcomingShows] = useState([]);
    const [pastShows, setPastShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const primary = siteData?.primary || '#000000';
    const siteName = siteData?.businessInfo?.name || siteData?.name || '';
    const upcomingLabel = resolvedLabels.upcoming ?? 'Upcoming';
    const pastLabel = resolvedLabels.past ?? 'Past';
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        setIsMobile(mq.matches);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    useEffect(() => {
        setLoading(true);
        if (resolvedShows.length === 0) {
            setUpcomingShows([]);
            setPastShows([]);
            setLoading(false);
            return;
        }
        const today = new Date();
        // Items with valid dates: split by date >= today
        // Items WITHOUT dates: go to upcoming (shown, not filtered out)
        const upcoming = resolvedShows
            .filter((show) => !show.date || new Date(show.date) >= today)
            .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());
        const past = resolvedShows
            .filter((show) => show.date && new Date(show.date) < today)
            .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
        setUpcomingShows(upcoming);
        setPastShows(past);
        setLoading(false);
    }, [resolvedShows]);
    return (_jsx("section", { style: { background: siteData?.surface }, className: "relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden", "aria-labelledby": "hero-heading", children: _jsxs("div", { className: "mx-5 md:mx-20 lg:mx-40", children: [_jsxs("div", { className: "grid items-center gap-12 sm:grid-cols-2", children: [_jsxs("div", { children: [_jsxs("h1", { id: "hero-heading", className: "text-4xl lg:text-5xl font-display font-bold tracking-tight", children: [_jsx("small", { style: { color: primary }, children: "Welcome to" }), _jsx("br", {}), _jsx("span", { style: { color: primary }, children: siteName })] }), _jsx("hr", { className: "my-6 border-gray-300" }), _jsx("p", { className: "text-gray-700 text-lg md:text-xl", children: siteData?.businessInfo?.description || 'Discover our latest content, upcoming events, and more.' }), resolvedPartners.length > 0 && (_jsxs("div", { className: "mt-8", children: [_jsx("p", { className: "text-sm font-medium text-gray-900 mb-4", children: siteData?.partnerTagline || 'Featuring top talent from these iconic stages and more!' }), _jsx("div", { className: "flex flex-wrap items-center gap-6 md:gap-8", children: resolvedPartners.map((partner, idx) => (_jsx(Img, { src: partner.logoUrl || '/logo.png', alt: partner.name, width: 120, height: 60, className: "max-h-16 md:max-h-20 max-w-[140px] md:max-w-[160px] w-auto h-auto object-contain grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all" }, idx))) })] }))] }), _jsx("div", { className: "flex justify-center", children: _jsx(Img, { src: siteData?.heroImage?.currentFile?.source || '/heroImage.png', alt: siteName, width: 600, height: 400, className: "w-full h-auto object-contain" }) })] }), _jsx("h2", { className: "text-2xl lg:text-3xl font-display font-bold mt-24 md:mt-32 tracking-tight", children: upcomingLabel }), loading ? (_jsx("div", { className: "flex flex-col gap-4 mt-6", "aria-busy": "true", children: [...Array(3)].map((_, i) => (_jsx(ShowSkeletonCard, { isMobile: isMobile }, i))) })) : upcomingShows.length === 0 ? (_jsx("p", { className: "mt-6 text-gray-500", children: "Nothing upcoming at the moment. Check back soon!" })) : (_jsx("div", { className: "flex flex-col gap-4 mt-6", children: upcomingShows.map((show, idx) => (_jsx(UpcomingShowCard, { show: show, isMobile: isMobile, primary: primary, showsSlug: resolvedShowsSlug }, idx))) })), _jsx("h2", { className: "text-2xl lg:text-3xl font-display font-bold mt-24 md:mt-32 tracking-tight", children: pastLabel }), loading ? (_jsx("div", { className: "flex gap-4 mt-6 overflow-hidden", "aria-busy": "true", children: [...Array(5)].map((_, i) => (_jsx(PastShowSkeleton, {}, i))) })) : pastShows.length === 0 ? (_jsx("p", { className: "mt-6 text-gray-500", children: "No past content yet." })) : (_jsx(PastShowsCarousel, { shows: pastShows, primary: primary, surface: siteData?.surface || '#ffffff', showsSlug: resolvedShowsSlug }))] }) }));
};
/* ------------------------------------------------------------------ */
/*  UpcomingShowCard                                                   */
/* ------------------------------------------------------------------ */
function UpcomingShowCard({ show, isMobile, primary, showsSlug, }) {
    const { LinkComponent, ImageComponent, previewMode = false } = useSiteRenderer();
    const Img = ImageComponent ?? 'img';
    const A = previewMode ? 'span' : (LinkComponent ?? 'a');
    return (_jsxs(A, { href: `/${showsSlug}/${show.id}`, className: `
        flex ${isMobile ? 'flex-col' : 'flex-row'}
        rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden
        transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
      `, children: [_jsx("div", { className: `
          ${isMobile ? 'w-full h-48 rounded-t-xl' : 'flex-shrink-0 w-44 h-auto rounded-l-xl'}
          overflow-hidden bg-gray-100
        `, children: _jsx(Img, { src: show.imageUrl || show.image || '/logo.png', alt: show.title || 'Content image', width: 0, height: 0, sizes: isMobile ? '100vw' : '350px', className: "w-full h-full object-contain" }) }), _jsxs("div", { className: `${isMobile ? 'p-5 rounded-b-xl flex flex-col items-center text-center' : 'flex-1 p-5 flex flex-col justify-between'}`, children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-semibold text-gray-900", children: show.title }), _jsxs("div", { className: "flex flex-wrap gap-3 mt-2 text-sm text-gray-500", children: [show.date && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(Calendar, { size: 14 }), new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(show.date)), show.time ? ` at ${show.time}` : ''] })), show.location && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(MapPin, { size: 14 }), show.location] }))] }), _jsx(ShowDescription, { html: show.description })] }), show.ticketsUrl ? (_jsxs("button", { type: "button", onClick: (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!previewMode) {
                                window.open(show.ticketsUrl, '_blank', 'noopener,noreferrer');
                            }
                        }, className: `
              mt-4 inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer text-white text-sm font-semibold rounded-lg transition-colors
              ${isMobile ? 'w-full max-w-xs justify-center' : 'w-max self-start'}
            `, style: { backgroundColor: primary }, "aria-label": "Open tickets in a new tab", children: ["Get Tickets ", _jsx(ArrowRight, { size: 14 })] })) : (_jsxs("span", { className: `mt-4 inline-flex items-center gap-1 text-sm font-medium ${isMobile ? '' : 'self-start'}`, style: { color: primary }, children: ["View Details ", _jsx(ArrowRight, { size: 14 })] }))] })] }));
}
/* ------------------------------------------------------------------ */
/*  ShowDescription                                                    */
/* ------------------------------------------------------------------ */
/**
 * Renders CMS rich-text description HTML.
 * Content is sanitized server-side by the CMS before storage.
 */
function ShowDescription({ html }) {
    return (_jsx("article", { className: "prose prose-p:min-h-[.4em]", children: _jsx("div", { className: "text-gray-600 text-sm mt-2 line-clamp-3", dangerouslySetInnerHTML: { __html: html } }) }));
}
/* ------------------------------------------------------------------ */
/*  PastShowsCarousel                                                  */
/* ------------------------------------------------------------------ */
/**
 * Horizontally auto-scrolling carousel for past shows.
 * Pauses on hover, supports manual prev/next navigation.
 */
function PastShowsCarousel({ shows, primary, surface, showsSlug = 'shows', }) {
    const { LinkComponent, ImageComponent } = useSiteRenderer();
    const Img = ImageComponent ?? 'img';
    const A = LinkComponent ?? 'a';
    const scrollRef = useRef(null);
    const pausedRef = useRef(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const updateScrollButtons = useCallback(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }, []);
    // Auto-scroll animation loop
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        let cancelled = false;
        let accum = 0; // accumulate sub-pixel increments
        const tick = () => {
            if (cancelled)
                return;
            if (!pausedRef.current && el.scrollWidth > el.clientWidth) {
                accum += SCROLL_SPEED;
                if (accum >= 1) {
                    const px = Math.floor(accum);
                    accum -= px;
                    el.scrollLeft += px;
                    if (el.scrollLeft >= el.scrollWidth - el.clientWidth) {
                        el.scrollLeft = 0;
                    }
                    updateScrollButtons();
                }
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        updateScrollButtons();
        return () => { cancelled = true; };
    }, [shows, updateScrollButtons]);
    const scrollBy = (dir) => {
        const el = scrollRef.current;
        if (!el)
            return;
        const cardWidth = 300; // w-72 = 288px + gap
        el.scrollBy({ left: dir * cardWidth * 2, behavior: 'smooth' });
        setTimeout(updateScrollButtons, 350);
    };
    return (_jsxs("div", { className: "relative group mt-6", onMouseEnter: () => { pausedRef.current = true; }, onMouseLeave: () => { pausedRef.current = false; }, children: [canScrollLeft && (_jsx("button", { type: "button", onClick: () => scrollBy(-1), className: "absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer", "aria-label": "Scroll left", children: _jsx(ChevronLeft, { size: 20, style: { color: primary } }) })), canScrollRight && (_jsx("button", { type: "button", onClick: () => scrollBy(1), className: "absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer", "aria-label": "Scroll right", children: _jsx(ChevronRight, { size: 20, style: { color: primary } }) })), _jsx("div", { className: "absolute left-0 top-0 bottom-0 w-16 z-[5] pointer-events-none", style: { background: `linear-gradient(to right, ${surface}, transparent)` } }), _jsx("div", { className: "absolute right-0 top-0 bottom-0 w-16 z-[5] pointer-events-none", style: { background: `linear-gradient(to left, ${surface}, transparent)` } }), _jsx("div", { ref: scrollRef, className: "flex gap-5 overflow-x-auto scrollbar-hide", style: { scrollbarWidth: 'none', msOverflowStyle: 'none' }, onScroll: updateScrollButtons, children: shows.map((show, idx) => (_jsxs(A, { href: `/${showsSlug}/${show.id}`, className: "relative flex-shrink-0 w-72 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100", children: [_jsx(Img, { src: show.imageUrl || show.image || '/logo.png', alt: show.title || `Past content ${idx + 1}`, width: 0, height: 0, sizes: "300px", className: "w-full h-96 object-contain", loading: "lazy" }), _jsxs("div", { className: "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4", children: [_jsx("p", { className: "text-white text-sm font-medium truncate", children: show.title }), show.date && (_jsx("p", { className: "text-white/70 text-xs", children: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(show.date)) }))] })] }, idx))) })] }));
}
export default HeroSectionShowcase;
