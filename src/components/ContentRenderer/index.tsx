"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import CardsLayout from "./layouts/CardsLayout";
import GridLayout from "./layouts/GridLayout";
import TableLayout from "./layouts/TableLayout";
import CarouselLayout from "./layouts/CarouselLayout";
import TimelineLayout from "./layouts/TimelineLayout";
import GalleryLayout from "./layouts/GalleryLayout";
import FeedLayout from "./layouts/FeedLayout";
import BannerLayout from "./layouts/BannerLayout";
import ShowcaseLayout from "./layouts/ShowcaseLayout";
import FeatureListLayout from "./layouts/FeatureListLayout";
import FormLayout from "./layouts/FormLayout";
import StatsLayout from "./layouts/StatsLayout";
import ReviewsLayout from "./layouts/ReviewsLayout";
import type { ComponentType } from "react";

const layoutMap: Record<string, ComponentType<ContentLayoutProps>> = {
  cards: CardsLayout,
  grid: GridLayout,
  table: TableLayout,
  carousel: CarouselLayout,
  timeline: TimelineLayout,
  gallery: GalleryLayout,
  feed: FeedLayout,
  banner: BannerLayout,
  showcase: ShowcaseLayout,
  "feature-list": FeatureListLayout,
  form: FormLayout,
  stats: StatsLayout,
  reviews: ReviewsLayout,
};

/** displayAs types that render full-width (no content-grid constraint) */
const FULL_BLEED = new Set(["banner"]);

export interface ContentRendererProps extends ContentLayoutProps {
  /** Which layout to render — defaults to 'cards' */
  displayAs?: string;
  /** Optional section heading shown above the content */
  label?: string;
  /** Optional subtitle shown below the heading */
  subtitle?: string;
}

export default function ContentRenderer({
  displayAs = "cards",
  label,
  subtitle,
  ...layoutProps
}: ContentRendererProps) {
  const Layout = layoutMap[displayAs] ?? CardsLayout;
  const isFullBleed = FULL_BLEED.has(displayAs);

  return (
    <section className={isFullBleed ? "" : "content-grid"}>
      {label && !isFullBleed && (
        <div className="mb-6">
          <h2
            className="text-2xl md:text-3xl font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {label}
          </h2>
          {subtitle && (
            <p className="mt-2 text-base text-black/50">{subtitle}</p>
          )}
        </div>
      )}
      <Layout {...layoutProps} />
    </section>
  );
}
