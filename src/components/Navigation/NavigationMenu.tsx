"use client";

import React, { useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuLinkTrigger,
  NavigationMenuViewport,
} from "@/components/UI/navigation-menu";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types/Navigation";
import { useSiteData } from "@/contexts/SiteDataContext";

interface NavigationMenuProps {
  items: NavItem[];
}

const colorShadows: Record<string, string> = {
  "text-green-700": "0 4px 12px rgba(34,197,94,0.3)",
  "text-blue-700": "0 4px 12px rgba(29,78,216,0.3)",
  "text-yellow-500": "0 4px 12px rgba(234,179,8,0.3)",
  "text-purple-700": "0 4px 12px rgba(126,34,206,0.3)",
  "text-red-700": "0 4px 12px rgba(185,28,28,0.3)",
};

const groupDisplayNames: Record<string, string> = {
  whatWeDo: "What We Do",
  faq: "FAQ",
  articles: "Articles",
  pricing: "Pricing",
};

const NavigationMenuComponent: React.FC<NavigationMenuProps> = ({ items }) => {
  const groupedItems = items.reduce<Record<string, NavItem[]>>((acc, item) => {
    const group = item.group || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  const siteData = useSiteData();
  const [hover, setHover] = useState([false, false, false, false, false]);

  const renderMenuItems = (items: NavItem[], depth = 0): JSX.Element[] =>
    items.map((item) => {
      const hasChildren = item.url && item.url.length > 0;
      if (hasChildren && item.linklabel === "Overview") {
        return (
          <div key={item.path} className="ml-2">
            {renderMenuItems(item.url!, depth + 1)}
          </div>
        );
      }
      return (
        <div key={item.path} className="space-y-1">
          <NavigationMenuLink asChild>
            <Link
              href={item.path}
              className={cn(
                "block rounded-md py-2 px-3 text-sm transition-all duration-200 font-medium",
                "hover:bg-gray-100 hover:text-black focus:bg-gray-100 focus:text-black"
              )}
            >
              {item.linklabel?.trim() ||
                item.path.split("/").pop()?.toUpperCase() ||
                "Untitled"}
            </Link>
          </NavigationMenuLink>

          {hasChildren && (
            <div className="ml-2">
              {renderMenuItems(item.url!, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  const handleMouseEnter = (index: number) => {
    const newHover = Array(hover.length).fill(false);
    newHover[index] = true;
    setHover(newHover);
  };

  const handleMouseLeave = (index: number) => {
    const copiedHover = [...hover];
    copiedHover[index] = false;
    setHover(copiedHover);
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slide-down {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px);
          }
        }

        .animate-slide-down {
          animation: slide-down 1000ms ease-out forwards;
        }

        .animate-slide-up {
          animation: slide-up 1000ms ease-in forwards;
        }
      `}</style>

      <NavigationMenu className="relative">
        <NavigationMenuList>
          {Object.entries(groupedItems)
            .filter(([group]) => group !== "other")
            .map(([group, groupItems]) => {
              const firstItem = groupItems[0];
              const hasChildren = firstItem?.url && firstItem.url.length > 0;
              const displayName =
                groupDisplayNames[group] ||
                group.charAt(0).toUpperCase() + group.slice(1);

              return (
                <NavigationMenuItem key={group} className="relative group">
                  {hasChildren ? (
                    <>
                      <NavigationMenuTrigger>
                        <span className="flex items-center">{displayName}</span>
                      </NavigationMenuTrigger>

                      <NavigationMenuContent
                        className={cn(
                          "min-w-[100vw] min-h-[30vh] px-6 pb-0 pt-0 bg-white shadow-lg transition-all duration-300",
                          "data-[state=open]:animate-slide-down",
                          "data-[state=closed]:animate-slide-up"
                        )}
                      >
                        <div className="flex gap-8 items-start">
                          {/* Left card */}
                          <div className="w-[300px] bg-white p-4 flex flex-col items-start space-y-4 rounded-lg">
                            <div className="w-full h-32 rounded-md overflow-hidden">
                              {firstItem.cardcomponent?.image && (
                                <firstItem.cardcomponent.image className="w-full h-full object-cover" />
                              )}
                            </div>
                            <h3 className="text-lg font-semibold">
                              {firstItem.cardcomponent?.title}
                            </h3>
                            <p className="text-sm text-gray-800">
                              {firstItem.cardcomponent?.subtitle}
                            </p>
                            {firstItem.cardcomponent?.link && (
                              <Link href={firstItem.cardcomponent.link}>
                                <Button
                                  style={{
                                    background: siteData?.primary,
                                    color: siteData?.["text-inverse"],
                                  }}
                                  size="sm"
                                  className="cursor-pointer font-medium rounded-full"
                                >
                                  {firstItem.cardcomponent?.buttonText ||
                                    "Learn More"}
                                </Button>
                              </Link>
                            )}
                          </div>

                          {/* Menu items */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start mt-4 w-full">
                            {firstItem.url
                              ?.filter(
                                (child: NavItem) =>
                                  child.path !== firstItem.path
                              )
                              .map(
                                (topLevelItem: NavItem, index: number) => {
                                  const shadow =
                                    colorShadows[topLevelItem.iconColor || ""];

                                  return (
                                    <div
                                      key={topLevelItem.path}
                                      className="space-y-2 min-w-[180px]"
                                    >
                                      <NavigationMenuLink asChild>
                                        <Link
                                          href={topLevelItem.path}
                                          style={{
                                            boxShadow:
                                              hover[index] && shadow
                                                ? shadow
                                                : "none",
                                          }}
                                          onMouseEnter={() =>
                                            handleMouseEnter(index)
                                          }
                                          onMouseLeave={() =>
                                            handleMouseLeave(index)
                                          }
                                          className={cn(
                                            "flex items-start rounded-md px-2 py-1.5 text-sm font-semibold transition-all duration-200 no-underline hover-lift",
                                            "focus:bg-muted focus:text-gray-800"
                                          )}
                                        >
                                          <div className="mr-2 mt-0.5">
                                            {topLevelItem.icon && (
                                              <topLevelItem.icon
                                                className={`h-5 w-5 ${topLevelItem.iconColor}`}
                                              />
                                            )}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="font-semibold">
                                              {topLevelItem.linklabel?.trim() ||
                                                "Untitled"}
                                            </span>
                                            {topLevelItem.subtitle && (
                                              <span className="text-xs font-normal text-gray-800">
                                                {topLevelItem.subtitle}
                                              </span>
                                            )}
                                          </div>
                                        </Link>
                                      </NavigationMenuLink>

                                      {topLevelItem.url && (
                                        <div className="mt-2 ml-6 space-y-1">
                                          {renderMenuItems(topLevelItem.url, 1)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              )}
                          </div>
                        </div>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <NavigationMenuLinkTrigger asChild>
                      <Link href="/pricing">{displayName}</Link>
                    </NavigationMenuLinkTrigger>
                  )}
                </NavigationMenuItem>
              );
            })}
        </NavigationMenuList>
        <NavigationMenuViewport />
      </NavigationMenu>
    </>
  );
};

export default NavigationMenuComponent;