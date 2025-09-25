import React from "react"
import { Link as RouterLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { NavItem } from "./types/navTypes"
import { Button } from "@/components/ui/button";
import { ArrowRight, Home } from 'lucide-react'
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
} from "@/components/ui/sidebar"

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
  open,
  handleClose,
}: MobileNavigationMenuProps) {
  const groupedItems = items.reduce((acc, item) => {
    const group = item.group || "other"
    if (!acc[group]) acc[group] = []
    acc[group].push(item)
    return acc
  }, {} as Record<string, NavItem[]>)

const renderLinks = (items: NavItem[], depth = 0): JSX.Element[] =>
  items.map((item) => {
    const Icon = item.icon;
    return (
      <div key={item.path} className="space-y-1">
        <RouterLink
          to={item.path}
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
        </RouterLink>

        {item.url && (
          <div className="ml-2">{renderLinks(item.url, depth + 1)}</div>
        )}
      </div>
    );
  });

  return (
    <SidebarProvider>
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="offcanvas"
        open={open}
        onOpenChange={(val) => {
          if (!val) handleClose()
        }}
      >
        <SidebarContent className="p-4">
          <div className="mt-2">
            <RouterLink to="/" onClick={handleClose} className="inline-flex items-center">
              <Home className="w-6 h-6 text-primary" />
            </RouterLink>
          </div>
          {Object.entries(groupedItems).map(([group, groupItems]) => {
            const [firstItem, ...restItems] = groupItems;
            const hasChildren = firstItem?.url && firstItem.url.length > 0;
            const displayName =
              groupDisplayNames[group] ||
              group.charAt(0).toUpperCase() + group.slice(1);
            return (
              <div key={group} className="mb-6">
                {
                  hasChildren
                  ?
                  <>
                    <h3 className="text-sm font-semibold mb-2 text-gray-800">
                      <RouterLink
                        to={firstItem.path}
                        onClick={handleClose}
                        className="text-primary hover:underline inline-flex items-center gap-1 transition"
                      >
                        {displayName}
                        <ArrowRight className="w-4 h-4" />
                      </RouterLink>
                    </h3>
                    <div>{renderLinks(firstItem?.url)}</div>
                  </>
                  :
                  <h3 className="text-sm font-semibold mb-2 text-gray-800">
                    <RouterLink
                      to={firstItem.path}
                      onClick={handleClose}
                      className="text-primary hover:underline inline-flex items-center gap-1 transition"
                    >
                      {displayName}
                      <ArrowRight className="w-4 h-4" />
                    </RouterLink>
                  </h3>
                }
              </div>
            )
          })}
          <div className="w-full space-y-3">
             <a
              href="https://app.vivreal.io/login/"
              onClick={() => {
                if (window.gtag) {
                  window.gtag('event', 'click', {
                    event_category: 'MobileNavbar',
                    event_label: 'Login',
                    value: 1
                  });
                }
              }}
            >
              <Button size="sm" className="w-full font-medium mb-3 ">
                Log in
              </Button>
            </a>
            <a
              href="/contact"
              onClick={() => {
                if (window.gtag) {
                  window.gtag('event', 'click', {
                    event_category: 'MobileNavbar',
                    event_label: 'Contact',
                    value: 1
                  });
                }
              }}
            >
              <Button variant="outline" size="sm" className="w-full font-medium">
                Contact Us
              </Button>
            </a>
          </div>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}