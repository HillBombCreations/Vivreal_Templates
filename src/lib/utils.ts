import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { XMLParser } from "fast-xml-parser";
import { LucideIcon } from 'lucide-react';
import {
  PiggyBank,
  Handshake,
  CalendarClock,
  Code,
  // Add more as needed
} from "lucide-react";

export interface SitemapEntry {
  loc: string;
  component?: string;
  group?: string;
  linklabel?: string;
  path?: string;
  url?: SitemapEntry[];
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function xmlToJSON(xml: string): SitemapEntry[] {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
    });

    const parsed = parser.parse(xml);
    if (!parsed.urlset || !parsed.urlset.url) {
      console.warn("Unexpected XML structure", parsed);
      return [];
    }
    return parsed.urlset.url;
}

export const iconMap: Record<string, LucideIcon> = {
  PiggyBank,
  Handshake,
  CalendarClock,
  Code,
};