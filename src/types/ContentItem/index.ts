export interface ContentItem {
  /** Unique ID (MongoDB _id) */
  id: string;
  /** Primary display title */
  title: string;
  /** Description or body text (may contain HTML) */
  description?: string;
  /** Image URL (signed CDN URL from VR_Client_API) */
  imageUrl?: string;
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
}
