export type Variantable<T> = T | Record<string, T>;

export interface Product {
    _id: string;
    name: Variantable<string>;
    price: Variantable<string>;
    description: Variantable<string>;
    imageUrl: Variantable<string>;
    /**
     * Ordered product gallery image URLs — `string[]` for non-variant products,
     * `{ variant: string[] }` for variant products. Empty/absent ⇒ the detail
     * hero falls back to the single `imageUrl` (legacy behavior).
     */
    gallery?: Variantable<string[]>;
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
}

export type ProductVariantKey = "name" | "price" | "description" | "imageUrl";

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
