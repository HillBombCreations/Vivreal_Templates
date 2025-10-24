"use client";

import React from "react"
import Link from "next/link";
import { cn } from "@/lib/utils"
import { NavItem } from "@/types/Navigation"
import { Button } from "@/components/ui/Button";
import { Home } from 'lucide-react'
import { useSiteData } from "@/contexts/SiteDataContext";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

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
  const groupedItems = items.reduce((acc, item) => {
      const group = item.group || "other"
      if (!acc[group]) acc[group] = []
      acc[group].push(item)
      return acc
    }, {} as Record<string, NavItem[]>);

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
            href="/review"
          >
            <Button style={{ color: siteData?.primary }} variant="outline" size="sm" className="w-full font-medium">
              Leave A Review
            </Button>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}