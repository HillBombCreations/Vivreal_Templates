"use client";

import React from "react"
import Link from "next/link";
import { cn } from "@/lib/utils"
import { NavItem } from "@/types/Navigation"
import { Button } from "@/components/UI/Button";
import { Home } from 'lucide-react'
import { useSiteData } from "@/contexts/SiteDataContext";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/UI/sheet"

interface MobileNavigationMenuProps {
  items: NavItem[]
  open: boolean
  handleClose: () => void
}

const groupDisplayNames: Record<string, string> = {
  coreconcepts: "Core Concepts",
  contentmanagement: "Content Management",
  integrations: "Integrations",
  stripe: "Stripe",
  tutorials: "Tutorials",
  settingupasite: "Setting Up a Site",
  developers: "Developers",
  other: "Other",
}

export default function MobileNavigationMenu({
  items,
  handleClose,
  open
}: MobileNavigationMenuProps) {
  const siteData = useSiteData();
  console.log('MobileNavigationMenu items:', items);
  const groupedItems = items.reduce((acc, item) => {
    const group = item.group || "other"
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {} as Record<string, NavItem[]>)

const renderLinks = (items: NavItem[], depth = 0): React.JSX.Element[] =>
  items.map((item) => {
    const Icon = item.icon;
    return (
      <div key={item.path} className="space-y-1">
        <Link
          href={item.path}
          onClick={handleClose}
          className={cn(
            "flex items-start gap-2 py-2 px-2 rounded-md transition-colors",
            "hover:bg-muted hover:text-foreground",
            depth === 0 ? "font-semibold" : `pl-${depth * 4} pr-2`
          )}
        >
          {Icon && <Icon className={`w-5 h-5 mt-0.5 ${item.iconColor}`} />}
          <div className="flex flex-col">
            <span className="text-sm">
              {item.linklabel?.trim() ||
                item.path.split("/").pop()?.toUpperCase() ||
                "Untitled"}
            </span>
          </div>
        </Link>

        {item.url && (
          <div className="ml-2">{renderLinks(item.url, depth + 1)}</div>
        )}
      </div>
    );
  });

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent style={{ background: siteData?.surface, overflowY: "auto" }} side="left" className="p-4">
        <SheetHeader>
          <SheetTitle>
            <VisuallyHidden>Mobile navigation menu</VisuallyHidden>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-2">
          <Link href="/" onClick={handleClose} className="inline-flex items-center">
            <Home style={{ color: siteData?.primary }} className="w-6 h-6" />
          </Link>
        </div>
        {Object.entries(groupedItems).map(([group, groupItems]) => {
          const displayName = groupDisplayNames[group] || group.charAt(0).toUpperCase() + group.slice(1);

          return (
            <div key={group} className="mb-6">
              <h3 style={{ color: siteData?.["text-primary"] }} className="text-sm font-semibold mb-2">
                {displayName !== "Other" && displayName}
              </h3>
              <div>
                {(groupItems as NavItem[]).map(item => (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={handleClose}
                    className="block py-2 px-2 rounded-md hover:bg-muted hover:text-foreground"
                    style={{ color: siteData?.primary }}
                  >
                    {item.label || "Untitled"}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
        <div className="w-full space-y-3">
          <a
            href="/contact"
            onClick={() => {
              if (window.gtag) {
                window.gtag("event", "click", {
                  event_category: "MobileNavbar",
                  event_label: "Contact",
                  value: 1,
                });
              }
            }}
          >
            <Button style={{ color: siteData?.primary }} variant="outline" size="sm" className="w-full font-medium">
              Contact Us
            </Button>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}