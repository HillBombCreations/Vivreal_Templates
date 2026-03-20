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

export interface ContentRendererProps extends ContentLayoutProps {
  /** Which layout to render — defaults to 'cards' */
  displayAs?: string;
}

export default function ContentRenderer({
  displayAs = "cards",
  ...layoutProps
}: ContentRendererProps) {
  const Layout = layoutMap[displayAs] ?? CardsLayout;
  return <Layout {...layoutProps} />;
}
