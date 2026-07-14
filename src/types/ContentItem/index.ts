export interface ContentItem {
  /** Unique ID (MongoDB _id) */
  id: string;
  /** Primary display title */
  title: string;
  /** Description or body text (may contain HTML) */
  description?: string;
  /** Image URL (signed CDN URL from VR_Client_API) */
  imageUrl?: string;
  /** Responsive srcset of the image's resized variants (empty/absent when no
   *  derivatives). Mirrors the renderer ContentItem field of the same name. */
  imageSrcSet?: string;
  /** `sizes` hint paired with `imageSrcSet`. */
  imageSizes?: string;
  /**
   * Art-directed responsive variants of the primary image (WS4 6.1). Each entry
   * pairs a CSS `media` query with its own signed `src` (+ optional `srcSet`);
   * the renderer's `ProductImage` renders them as `<picture><source media>`.
   * Absent when the object has only a plain single-image descriptor. Mirrors the
   * renderer ContentItem field of the same name.
   */
  artDirectedSources?: Array<{ media: string; src: string; srcSet?: string }>;
  /** Price string (products) */
  price?: string;
  /** Date (shows/events) */
  date?: string;
  /** Link URL (external or detail page) */
  href?: string;
  /** Tags / categories */
  tags?: string[];
  /** Source type: which integration or collection this came from */
  source: 'collection' | 'integration';
  /** Integration type if source is integration */
  integrationType?: string;
  /** Raw objectValue for custom field access */
  raw?: Record<string, unknown>;
  /** Variant info for products */
  variant?: {
    values: string[];
    selectedValue?: string;
  };
}

export interface ContentLayoutProps {
  items: ContentItem[];
  /** Page slug — for building detail links */
  slug: string;
  /** Whether clicking an item navigates to a detail page */
  detailEnabled?: boolean;
  /** Site primary color */
  accent?: string;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Page-level labels for layouts that need hero/page config */
  pageLabels?: Record<string, unknown>;
  /**
   * Per-section configuration carried from `PageCollectionBinding.sectionConfig`.
   * Opaque here; consumed by individual layouts (e.g. `ReviewsLayout` reads
   * `ratingIcon` / `ratingMax` / `ratingField`). Mirrors the renderer's
   * `ContentLayoutProps.sectionConfig`.
   */
  sectionConfig?: Record<string, unknown>;
}
