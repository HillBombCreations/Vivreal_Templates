import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { LucideIcon } from 'lucide-react';
import { XMLParser } from "fast-xml-parser";
import {
  PiggyBank,
  Handshake,
  CalendarClock,
  Code,
  Users,
  UserCheck,
  BarChart2,
  Clock,
  Calendar,
  ClipboardList,
  Zap,
  Server,
  ShieldCheck,
  Layers,
  Globe,
  Lock,
  MessageSquare
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

export const iconMap: Record<string, LucideIcon> = {
  PiggyBank,
  Handshake,
  CalendarClock,
  Code,
  Users,
  UserCheck,
  BarChart2,
  Clock,
  Calendar,
  ClipboardList,
  Zap,
  Server,
  ShieldCheck,
  Layers,
  Globe,
  Lock,
  MessageSquare
};

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

export const hexToRgba = (hex: string, alpha: number): string => {
  hex = hex.replace("#", "");

  if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const EMAIL_POPUP_KEY = "email_popup_last_seen";
const EMAIL_SUBSCRIBED_KEY = "email_subscribed";

export function shouldShowEmailPopup(): boolean {
  if (typeof window === "undefined") return false;

  const subscribed = localStorage.getItem(EMAIL_SUBSCRIBED_KEY);
  if (subscribed === "true") return false;

  const lastSeen = localStorage.getItem(EMAIL_POPUP_KEY);
  if (!lastSeen) return true;

  const hoursSince = (Date.now() - parseInt(lastSeen, 10)) / (1000 * 60 * 60);
  return hoursSince >= 24;
}

export function recordPopupSeen() {
  localStorage.setItem(EMAIL_POPUP_KEY, Date.now().toString());
}

export function recordSubscription() {
  localStorage.setItem(EMAIL_SUBSCRIBED_KEY, "true");
}

export function capitalizeString(input: string): string {
  if (!input) return input;

  return input
    .trim()
    .split(/\s+/) 
    .map(word => {
      if (!word) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}