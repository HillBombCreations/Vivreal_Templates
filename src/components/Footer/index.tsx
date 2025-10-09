"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link";
import Image from 'next/image';
import { cn, xmlToJSON } from '@/lib/utils';
import { NavItem } from '@/types/Navigation';
import axios from 'axios';

interface SitemapEntry {
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
}

type SitemapJSON = Array<SitemapEntry>;

interface FooterLinkProps {
  href: string;
  label: string;
  className?: string;
  target?: string;
}

const FooterLink = ({ href, label, className, target }: FooterLinkProps) => (
  <Link
    href={href}
    target={target || '_self'}
    className={cn('text-sm text-gray-800 hover:text-foreground transition-colors', className)}
  >
    {label}
  </Link>
);

const DiscordIcon = () => (
  <Image
    src="/discordLogo.svg"
    alt="Discord Logo"
    width={20}
    height={20}
    className="h-[20px] w-[20px]"
  />
);

const RedditIcon = () => (
  <Image
    src="/redditLogo.svg"
    alt="Reddit Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const XIcon = () => (
  <Image
    src="/xLogo.png"
    alt="X Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const LinkedInIcon = () => (
  <Image
    src="/linkedInLogo.png"
    alt="LinkedIn Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const FacebookIcon = () => (
  <Image
    src="/facebookLogo.png"
    alt="Meta Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);


// Display names for groups
const groupDisplayNames: Record<string, string> = {
  coreconcepts: "Core Concepts",
  contentmanagement: "Content Management",
  integrations: "Integrations",
  stripe: "Stripe",
  tutorials: "Tutorials",
  settingupasite: "Setting up a Site",
  developers: "Developers",
  other: "Other",
};

function buildNavTree(entries: SitemapEntry[]): NavItem[] {
  const result: NavItem[] = [];

  entries.forEach(entry => {
    const segments = entry.path.split('/').filter(Boolean);
    let currentLevel = result;

    segments.forEach((segment, index) => {
      const fullPath = '/' + segments.slice(0, index + 1).join('/');
      const existingItem = currentLevel.find(item => item.path === fullPath);

      if (existingItem) {
        if (!existingItem.url) existingItem.url = [];
        currentLevel = existingItem.url;
      } else {
        const isLeaf = index === segments.length - 1;

        const newItem: NavItem = {
          path: fullPath,
          linklabel: entry.linklabel,
          group: entry.group,
          url: isLeaf ? undefined : []
        };

        currentLevel.push(newItem);
        if (!isLeaf) currentLevel = newItem.url!;
      }
    });
  });

  return result;
}

function normalizeSitemapEntries(entry: Partial<SitemapEntry>): SitemapEntry[] {
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
        group: Array.isArray(entry.group) ? entry.group[i] : entry.group,
        linklabel: Array.isArray(entry.linklabel) ? entry.linklabel[i] : entry.linklabel,
        path: Array.isArray(entry.path) ? entry.path[i] : entry.path,
        url: children,
      });
    }

    return entries;
  }

  return [{
    group: entry.group,
    linklabel: entry.linklabel,
    path: entry.path ?? "",
    url: entry.url
      ? Array.isArray(entry.url)
        ? entry.url.flatMap(normalizeSitemapEntries)
        : normalizeSitemapEntries(entry.url)
      : undefined,
  }];
}

function flattenSitemap(entries: SitemapEntry[]): SitemapEntry[] {
  return entries.flatMap((entry) => {
    const current = { ...entry };
    const children = current.url ? flattenSitemap(current.url) : [];
    delete current.url;
    return [current, ...children];
  });
}

const renderFooterLinks = (items: NavItem[], depth = 0): React.ReactElement[] => {
  return items.map((item) => {
    const hasChildren = item.url && item.url.length > 0;
    if (hasChildren && item.linklabel === "Overview") {
      return (
        <div key={item.path}>
          {renderFooterLinks(item.url!, depth + 1)}
        </div>
      );
    }

    return (
      <div key={item.path} className={cn("space-y-1")}>
        <FooterLink
          href={item.path}
          label={item.linklabel || item.path.split("/").pop() || "Untitled"}
          className={cn(depth === 0 ? "font-semibold" : "text-sm")}
        />
        {hasChildren && (
          <div className="space-y-1">
            {renderFooterLinks(item.url!, depth + 1)}
          </div>
        )}
      </div>
    );
  });
};

const Footer = () => {
  const [groupedItems, setGroupedItems] = useState<Record<string, NavItem[]>>({});
  const currentYear = new Date().getFullYear();

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
            group: u.group
          }));

        const seen = new Set();
        const uniqueFlatItems = flatItems.filter((item) => {
          if (seen.has(item.path)) return false;
          seen.add(item.path);
          return true;
        });

        const nestedItems = buildNavTree(uniqueFlatItems);
        const localGroupedItems = nestedItems.reduce((acc, item) => {
          const group = item.group || "other";
          if (!acc[group]) acc[group] = [];
          acc[group].push(item);
          return acc;
        }, {} as Record<string, NavItem[]>);
        setGroupedItems(localGroupedItems)
      } catch (error) {
        console.error('Error fetching sitemap:', error);
            <Link href="/" className="flex items-center mb-4">
              <Image src="/vivreallogo.svg" alt="Vivreal" width={128} height={32} className="h-8" />
            </Link>
      }
    }

    fetchSitemap();
  }, []);

  return (
    <footer className="py-12 md:py-16 bg-secondary/50">
      <div className="content-grid">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-full md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <Image src="/vivreallogo.svg" alt="Vivreal" width={128} height={32} className="h-8" />
            </Link>
            <p className="text-sm text-gray-800 mb-6 max-w-xs">
              A powerful headless CMS platform that gives developers and content creators the freedom to build and deploy exceptional digital experiences.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.linkedin.com/company/vivreal" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground pt-1 transition-colors">
                <LinkedInIcon />
              </a>
              <a href="https://x.com/Vivreal_io" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <XIcon />
              </a>
              <a href="https://www.facebook.com/vivreal.cms" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <FacebookIcon />
              </a>
              <a href="https://www.reddit.com/r/Vivreal" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <RedditIcon />
              </a>
              <a href="https://discord.gg/8vr5vK3C" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <DiscordIcon />
              </a>
            </div>
          </div>
          <div className="col-span-full md:col-span-3 grid grid-cols-2 gap-8">
            {Object.entries(groupedItems)
            .filter(([group]) => group !== "other")
            .map(([group, groupItems]) => {
              const parent = groupItems[0];
              const label =
                groupDisplayNames[group] ||
                group.charAt(0).toUpperCase() + group.slice(1);
              return (
                <div key={group} className="space-y-3">
                  {
                    <Link href={parent.path} className="font-medium text-sm mb-3 hover:underline inline-flex items-center gap-1">
                      {label}
                    </Link>
                  }
                  
                  {
                    parent?.url && (
                      <div className="flex flex-col space-y-2">
                        {renderFooterLinks(parent.url)}
                      </div>
                    )
                  }
                </div>
              )
            }
            )}
            <div className="space-y-3">
              {
                <Link href="/contact" className="font-medium text-sm mb-3 hover:underline inline-flex items-center gap-1">
                  {"Contact Us"}
                </Link>
              }
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-8">
          <p className="text-sm text-gray-800 text-center">
            © {currentYear} Vivreal. All rights reserved.{' '}
            <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>{' | '}
            <a href="/terms" className="underline hover:text-blue-600">Terms of Use</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;