"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/Button";
import { cn, xmlToJSON } from "@/lib/utils";
import Link from "next/link";
import { useSiteData } from '@/contexts/SiteDataContext';
import { NavItem } from "@/types/Navigation";
import { NavbarCardComponent } from "@/components/customSvgs/NavbarCardComponent";
import NavigationMenuComponent from './NavigationMenu';
import MobileNavigationMenu from './MobileNavigationMenu';

import axios from 'axios';
import {
  Newspaper,
  FileText,
  Globe,
  Menu,
  Megaphone,
  Plug,
  CalendarClock,
  Layers,
  BarChart2,
  ClipboardList,
  Clock,
  ShoppingCart,
  PiggyBank,
  Folder,
  Database,
  Users,
  PlugIcon
} from "lucide-react";

type SitemapEntry = {
  path: string;
  linklabel?: string;
  group?: string;
  url?: SitemapEntry[];
  iconcolor?: string;
  iconstring?: string;
  subtitle?: string;
  component?: string;
  'custom:component'?: string;
  'custom:group'?: string;
  'custom:linklabel'?: string;
  'custom:path'?: string;
  'custom:iconcolor'?: string;
  'custom:iconstring'?: string;
  'custom:subtitle'?: string;
};

type SitemapJSON = Array<SitemapEntry>;

const iconDict: Record<string, React.ElementType> = {
  quickUpdates: Clock,
  scheduling: CalendarClock,
  dataAnalytics: BarChart2,
  orderAnalytics: ClipboardList,
  contentHub: Layers,
  contentLibrary: Newspaper,
  websites: Globe,
  documentation: FileText,
  multichannel: Megaphone,
  integrations: Plug,
  sellOnline: ShoppingCart,
  competitivePricing: PiggyBank,
  folder: Folder,
  database: Database,
  users: Users,
  plug: PlugIcon
};

const normalizeSitemapEntries = (entry: Partial<SitemapEntry>): SitemapEntry[] => {
  if (entry['custom:component']) {
    entry.component = entry['custom:component'];
    delete entry['custom:component'];
  }
  if (entry['custom:group']) {
    entry.group = entry['custom:group'];
    delete entry['custom:group'];
  }
  if (entry['custom:linklabel']) {
    entry.linklabel = entry['custom:linklabel'];
    delete entry['custom:linklabel'];
  }
  if (entry['custom:path']) {
    entry.path = entry['custom:path'];
    delete entry['custom:path'];
  }
  if (entry['custom:iconcolor']) {
    entry.iconcolor = entry['custom:iconcolor'];
    delete entry['custom:iconcolor'];
  }
  if (entry['custom:iconstring']) {
    entry.iconstring = entry['custom:iconstring'];
    delete entry['custom:iconstring'];
  }
  if (entry['custom:subtitle']) {
    entry.subtitle = entry['custom:subtitle'];
    delete entry['custom:subtitle'];
  }

  if (Array.isArray(entry.path)) {
    const length = entry.path.length;
    const entries: SitemapEntry[] = [];

    for (let i = 0; i < length; i++) {
      const children = Array.isArray(entry.url)
        ? normalizeSitemapEntries(entry.url[i])
        : entry?.url
        ? normalizeSitemapEntries(entry.url)
        : undefined;

      entries.push({
        component: entry.component,
        group: entry.group,
        linklabel: entry.linklabel,
        path: entry.path ?? '',
        iconstring: entry.iconstring || '',
        iconcolor: entry.iconcolor || '',
        subtitle: entry.subtitle || '',
        url: children,
      });
    }

    return entries;
  }

  return [{
    component: entry.component,
    group: entry.group,
    linklabel: entry.linklabel,
    path: entry.path ?? '',
    iconstring: entry.iconstring || '',
    iconcolor: entry.iconcolor || '',
    subtitle: entry.subtitle || '',
    url: entry.url
      ? Array.isArray(entry.url)
        ? entry.url.flatMap(normalizeSitemapEntries)
        : normalizeSitemapEntries(entry.url)
      : undefined,
  }];
}

function buildNavTree(entries: SitemapEntry[]): NavItem[] {
  const result: NavItem[] = [];
  
  entries.forEach(entry => {
    const segments = entry.path.split('/').filter(Boolean);
    let currentLevel = result;
    segments.forEach((segment, index) => {
      const fullPath = '/' + segments.slice(0, index + 1).join('/');
      const existingItem = currentLevel.find(item => item.path === fullPath);
      const IconComponent = entry.iconstring ? iconDict[entry.iconstring] : undefined;
      const cardComponent = entry.group ? NavbarCardComponent[entry.group] : undefined;

      if (existingItem) {
        if (!existingItem.url) existingItem.url = [];
        currentLevel = existingItem.url;
      } else {
        const isLeaf = index === segments.length - 1;

        const newItem: NavItem = {
          path: fullPath,
          linklabel: entry.linklabel,
          group: entry.group,
          subtitle: entry.subtitle,
          cardcomponent: cardComponent ?? undefined,
          url: isLeaf ? undefined : []
        };

        if (entry.iconstring) {
          newItem.icon = IconComponent;
          newItem.iconColor = entry.iconcolor;
        }

        currentLevel.push(newItem);
        if (!isLeaf) currentLevel = newItem.url!;
      }
    });
  });

  return result;
}

function flattenSitemap(entries: SitemapEntry[]): SitemapEntry[] {
  return entries.flatMap((entry) => {
    const current = { ...entry };
    const children = current.url ? flattenSitemap(current.url) : [];
    delete current.url;
    return [current, ...children];
  });
}

const Navbar = () => {
    const siteData = useSiteData();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [navItems, setNavItems] = useState<NavItem[]>([]);

    useEffect(() => {
    const handleScroll = () => {
        setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
     return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
      if (mobileMenuOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }

      return () => {
          document.body.style.overflow = '';
      };
    }, [mobileMenuOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const fetchSitemap = async () => {
      try {
        const { data } = await axios.get('/sitemap.xml', {
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        });
        const urls = xmlToJSON(data) as SitemapJSON;
        const normalized = urls.flatMap(normalizeSitemapEntries);
        const allEntries = flattenSitemap(normalized);
        const flatItems = allEntries
          .filter((u) => !!u.path && !!u.group)
          .map((u) => ({
            path: u.path,
            linklabel: u.linklabel
              ? u.linklabel.charAt(0).toUpperCase() + u.linklabel.slice(1)
              : (u.path.split('/').pop() || '').charAt(0).toUpperCase() + (u.path.split('/').pop() || '').slice(1),
            group: u.group,
            iconstring: u.iconstring,
            iconcolor: u.iconcolor,
            subtitle: u.subtitle,
          }));

        const seen = new Set();
        const uniqueFlatItems = flatItems.filter((item) => {
          if (seen.has(item.path)) return false;
          seen.add(item.path);
          return true;
        });

        const nestedItems = buildNavTree(uniqueFlatItems);

        setNavItems(nestedItems);
      } catch (error) {
        console.error('Error fetching sitemap:', error);
      }
    };

    fetchSitemap();
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out py-4 md:py-5",
        isScrolled ? "bg-glass border-b" : "bg-transparent"
      )}
    >
      <div className="w-full px-4">
        {!isMobile ? (
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image src="/vivreallogo.svg" alt="Vivreal" width={128} height={32} className="h-8" />
            </Link>

            <nav className="flex items-center">
              <NavigationMenuComponent items={navItems} />
            </nav>

            <div className="flex items-center space-x-3">
              <a
                href="/contact"
                onClick={() => {
                  if (window.gtag) {
                    window.gtag('event', 'click', {
                      event_category: 'DesktopNavbar',
                      event_label: 'Contact Us',
                      value: 1,
                    });
                  }
                }}
              >
                <Button variant="outline" style={{ color: siteData?.primary }} size="sm" className="font-medium cursor-pointer">
                  Contact Us
                </Button>
              </a>
              <a
                href="https://app.vivreal.io/login/"
                onClick={() => {
                  if (window.gtag) {
                    window.gtag('event', 'click', {
                      event_category: 'DesktopNavbar',
                      event_label: 'Login',
                      value: 1
                    });
                  }
                }}
              >
                <Button size="sm" style={{ background: siteData?.primary, color: siteData?.["text-inverse"] }} className="font-medium cursor-pointer">
                  Log in
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <Link href="/" className="flex-1 text-start">
              <Image src="/vivreallogo.svg" alt="Vivreal" width={128} height={32} className="h-8 inline-block" />
            </Link>
            <button
              className="p-2"
              onClick={() => {
                console.log('Opening mobile menu');
                setMobileMenuOpen(true)
              }}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
        )}
      </div>
      {isMobile && mobileMenuOpen && (
        <MobileNavigationMenu
          items={navItems}
          open={mobileMenuOpen}
          handleClose={() => {
                setMobileMenuOpen(false)
            }}
        />
      )}
    </header>
  );
};

export default Navbar;