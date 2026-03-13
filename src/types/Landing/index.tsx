import { JSX } from "react";
import { Lightbulb, Target, Handshake } from "lucide-react";

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

export type LandingSections = Record<string, LandingSection>;

export type ToastState =
    | { open: false }
    | { open: true; type: "success" | "error"; message: string };

export type FeatureIcon = "lightBulb" | "target" | "heart";

export const IconMap: Record<FeatureIcon, JSX.Element> = {
    lightBulb: <Lightbulb className="h-4 w-4" />,
    target: <Target className="h-4 w-4" />,
    heart: <Handshake className="h-4 w-4" />,
};
