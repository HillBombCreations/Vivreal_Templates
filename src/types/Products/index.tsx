export type Variantable<T> = T | Record<string, T>;

export interface Product {
    _id: string;
    name: Variantable<string>;
    price: Variantable<string>;
    description: Variantable<string>;
    imageUrl: Variantable<string>;
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
    quantityUnit?: string;
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
