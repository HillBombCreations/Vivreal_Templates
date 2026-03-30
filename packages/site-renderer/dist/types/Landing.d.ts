import type { JSX } from "react";
export interface LandingSection {
    title?: string;
    subtitle?: string;
    buttonLabel?: string;
    imageUrl?: string;
    sectionName?: string;
    [key: string]: unknown;
}
export interface ProductShowcaseItem {
    _id?: string;
    title: string;
    description: string;
    imageUrl: string;
    "product-type"?: string;
    buttonLabel?: string;
}
export interface OfferingItem {
    _id?: string;
    title: string;
    description: string;
    icon?: string;
    imageUrl?: string;
}
export type ToastState = {
    open: false;
} | {
    open: true;
    type: "success" | "error";
    message: string;
};
export type FeatureIcon = "lightBulb" | "target" | "heart";
export declare const IconMap: Record<FeatureIcon, JSX.Element>;
//# sourceMappingURL=Landing.d.ts.map