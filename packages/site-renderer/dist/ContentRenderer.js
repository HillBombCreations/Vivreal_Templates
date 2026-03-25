import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CardsLayout from './layouts/CardsLayout';
import GridLayout from './layouts/GridLayout';
import TableLayout from './layouts/TableLayout';
import CarouselLayout from './layouts/CarouselLayout';
import TimelineLayout from './layouts/TimelineLayout';
import GalleryLayout from './layouts/GalleryLayout';
import FeedLayout from './layouts/FeedLayout';
import BannerLayout from './layouts/BannerLayout';
import ShowcaseLayout from './layouts/ShowcaseLayout';
import FeatureListLayout from './layouts/FeatureListLayout';
import FormLayout from './layouts/FormLayout';
import StatsLayout from './layouts/StatsLayout';
import ReviewsLayout from './layouts/ReviewsLayout';
const layoutMap = {
    cards: CardsLayout,
    grid: GridLayout,
    table: TableLayout,
    carousel: CarouselLayout,
    timeline: TimelineLayout,
    gallery: GalleryLayout,
    feed: FeedLayout,
    banner: BannerLayout,
    showcase: ShowcaseLayout,
    'feature-list': FeatureListLayout,
    form: FormLayout,
    stats: StatsLayout,
    reviews: ReviewsLayout,
};
/** displayAs types that render full-width (no content-grid constraint) */
const FULL_BLEED = new Set(['banner']);
export default function ContentRenderer({ displayAs = 'cards', label, subtitle, ...layoutProps }) {
    const Layout = layoutMap[displayAs] ?? CardsLayout;
    const isFullBleed = FULL_BLEED.has(displayAs);
    return (_jsxs("section", { className: isFullBleed ? '' : 'content-grid py-16 md:py-24', children: [label && !isFullBleed && (_jsxs("div", { className: "mb-8 md:mb-12 text-center", children: [_jsx("h2", { className: "text-3xl md:text-4xl font-bold tracking-tight", style: { color: 'var(--text-primary)' }, children: label }), subtitle && (_jsx("p", { className: "mt-3 text-base md:text-lg text-black/50 max-w-2xl mx-auto leading-relaxed", children: subtitle }))] })), _jsx(Layout, { ...layoutProps })] }));
}
