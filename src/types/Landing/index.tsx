export interface LandingSection {
    title?: string;
    subtitle?: string;
    buttonLabel?: string;
    imageUrl?: string;
    sectionName?: string;
    [key: string]: unknown;
}

export interface ProductShowcaseItem {
    title: string;
    description: string;
    imageUrl: string;
    "product-type"?: string;
    buttonLabel?: string;
}

export interface OfferingItem {
    title: string;
    description: string;
    icon?: string;
    imageUrl?: string;
}

export type LandingSections = Record<string, LandingSection>;

export type ToastState =
    | { open: false }
    | { open: true; type: "success" | "error"; message: string };
