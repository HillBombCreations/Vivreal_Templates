export type Variantable<T> = T | Record<string, T>;

export interface Product {
    _id: string;
    name: Variantable<string>;
    price: Variantable<string>;
    description: Variantable<string>;
    imageUrl: Variantable<string>;
    /** Responsive srcset of the PRIMARY image's resized variants (when the CMS
     *  has generated derivatives). Mirrors `imageUrl`'s variant shape. */
    imageSrcSet?: Variantable<string>;
    /**
     * Ordered product gallery image URLs — `string[]` for non-variant products,
     * `{ variant: string[] }` for variant products. Empty/absent ⇒ the detail
     * hero falls back to the single `imageUrl` (legacy behavior).
     */
    gallery?: Variantable<string[]>;
    /**
     * Per-gallery-image responsive srcset, index-aligned to a FLAT `gallery`
     * (string[]). Only populated for non-variant products — variant galleries
     * carry no flat srcset (the renderer detects the variant shape and skips).
     * Absent ⇒ gallery images fall back to their single source.
     */
    gallerySrcSet?: string[];
    link?: string;
    productType?: string;
    buttonLabel?: string;
    "filter-type"?: string;
    usingVariant?: {
        name: string;
        values: string[];
    };
    default_price?: Variantable<string>;
    quantityOptions?: number[];
    /** Unit label beside the quantity picker — scalar, or a per-variant map (matches `price`'s keys). */
    quantityUnit?: Variantable<string>;
    /** Inventory count — scalar (single-price) or a map keyed by variant value. */
    stock?: Variantable<number>;
    /** Per-product low-stock trigger; renderer falls back to its global default. */
    lowStockThreshold?: number;
    /**
     * Public-sale DISPLAY fields (plan §5). Scalar or `Variantable<number>`
     * (per-variant sales, OQ3). Absent ⇒ not on sale. The renderer shows the
     * struck/sale price; Stripe applies the authoritative discount at checkout.
     *   - `salePercent`  whole-number percent (10 == 10% off)
     *   - `saleAmount`   fixed amount off, in CENTS
     *   - `saleStart` / `saleEnd`  ISO date strings bounding the active window
     */
    salePercent?: Variantable<number>;
    saleAmount?: Variantable<number>;
    saleStart?: string;
    saleEnd?: string;
}

export type ProductVariantKey = "name" | "price" | "description" | "imageUrl" | "imageSrcSet";

export interface Filter {
    title: string;
    filters: string[];
    key: string;
    type?: string;
}

export interface SortOption {
    key: string;
    label: string;
}

export interface Image {
    name: string;
    key: string;
    type: string;
}
