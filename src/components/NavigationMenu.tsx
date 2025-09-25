import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuLinkTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { NavItem } from "./types/navTypes";

interface NavigationMenuProps {
  items: NavItem[];
}

const shadowMap: Record<string, string> = {
  "text-green-700": "hover:shadow-[0_4px_12px_rgba(34,197,94,0.3)]",   // green-700
  "text-blue-700": "hover:shadow-[0_4px_12px_rgba(59,130,246,0.3)]",   // blue-700
  "text-yellow-500": "hover:shadow-[0_4px_12px_rgba(234,179,8,0.3)]",  // yellow-500
  "text-purple-700": "hover:shadow-[0_4px_12px_rgba(168,85,247,0.3)]", // purple-700
  "text-red-700": "hover:shadow-[0_4px_12px_rgba(239,68,68,0.3)]",
};



const groupDisplayNames: Record<string, string> = {
  whatWeDo: "What We Do",
  faq: "FAQ",
  articles: "Articles",
  pricing: "Pricing"
};

const NavigationMenuComponent: React.FC<NavigationMenuProps> = ({ items }) => {
  const groupedItems = items.reduce((acc, item) => {
    const group = item.group || "other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);
  
  const renderMenuItems = (items: NavItem[], depth = 0): JSX.Element[] =>
    items.map((item) => {
      const hasChildren = item.url && item.url.length > 0;
      if (hasChildren && item.linklabel === "Overview") {
        return (
          <div className="ml-2">
            {renderMenuItems(item.url!, depth + 1)}
          </div>
        )
      }
      return (
        <div key={item.path} className="space-y-1">
          <NavigationMenuLink asChild>
            <RouterLink
              to={item.path}
              className={cn(
                "block rounded-md py-1.5 text-sm transition-colors no-underline",
                "hover:bg-muted hover:text-gray-800 focus:bg-muted focus:text-gray-800",
                depth === 0 ? "font-semibold px-2" : `pl-${depth * 4} pr-2`
              )}
            >
              {item.linklabel?.trim() ||
                item.path.split("/").pop()?.toUpperCase() ||
                "Untitled"}
            </RouterLink>
          </NavigationMenuLink>

          {hasChildren && (
            <div className="ml-2">
              {renderMenuItems(item.url!, depth + 1)}
            </div>
          )}
        </div>
      );
  });

  return (
    <NavigationMenu className="relative">
      <NavigationMenuList>
        {Object.entries(groupedItems)
          .filter(([group]) => group !== "other")
          .map(([group, groupItems]) => {
            const firstItem = groupItems[0];
            const hasChildren = firstItem?.url && firstItem.url.length > 0;
            const displayName = groupDisplayNames[group] || group.charAt(0).toUpperCase() + group.slice(1);
            return (
              <NavigationMenuItem key={group} className="relative group">
                {hasChildren ? (
                  <>
                     <NavigationMenuTrigger>
                      <span className="flex items-center">
                        {displayName}
                      </span>
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="w-full min-w-[100vw] min-h-[30vh] px-6 pb-0 pt-0">
                      <div className="flex gap-8 items-start">
                        <div className="w-[300px] bg-gray-50 p-4 flex flex-col items-start space-y-4">
                          <div className="w-full h-32 rounded-md overflow-hidden">
                            {firstItem.cardcomponent.image && (
                              <firstItem.cardcomponent.image className="w-full h-full object-cover" />
                            )}
                          </div>
                          <h3 className="text-lg font-semibold">{firstItem.cardcomponent.title}</h3>
                          <p className="text-sm text-gray-800">
                            {firstItem.cardcomponent.subtitle}
                          </p>
                          <RouterLink to={firstItem.cardcomponent.link}>
                            <Button size="sm" className="font-medium rounded-full">
                              Create Your Free Account
                            </Button>
                          </RouterLink>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start mt-4 w-full">
                          {firstItem.url
                            ?.filter((child) => child.path !== firstItem.path)
                            .map((topLevelItem) => {
                              return (    
                                <div key={topLevelItem.path} className="space-y-2 min-w-[180px]">
                                  <NavigationMenuLink asChild>
                                    <RouterLink
                                      to={topLevelItem.path}
                                      className={cn(
                                        "flex items-start rounded-md px-2 py-1.5 text-sm font-semibold transition-colors no-underline",
                                        "focus:bg-muted focus:text-gray-800",
                                        shadowMap[topLevelItem.iconColor || ""] || ""
                                      )}
                                    >
                                      <div className="mr-2 mt-0.5">
                                        {topLevelItem.icon && (
                                          <topLevelItem.icon className={`h-5 w-5 ${topLevelItem.iconColor}`}  />
                                        )}
                                      </div>

                                      <div className="flex flex-col">
                                        <span className="font-semibold">{topLevelItem.linklabel?.trim() || "Untitled"}</span>
                                        {topLevelItem.subtitle && (
                                          <span className="text-xs font-normal text-gray-800">
                                            {topLevelItem.subtitle}
                                          </span>
                                        )}
                                      </div>
                                    </RouterLink>
                                  </NavigationMenuLink>
                                  {topLevelItem.url && (
                                    <div className="mt-2 ml-6 space-y-1">
                                      {renderMenuItems(topLevelItem.url, 1)}
                                    </div>
                                  )}
                                </div>
                            )})}
                        </div>
                      </div>
                    </NavigationMenuContent>
                  </>
                ) : (
                  
                   <NavigationMenuLinkTrigger asChild>
                     <RouterLink to="/pricing">
                      {displayName}
                    </RouterLink>
                  </NavigationMenuLinkTrigger>
                )}
              </NavigationMenuItem>
            );
          })}
      </NavigationMenuList>
      <NavigationMenuViewport />
    </NavigationMenu>
  );
};

export default NavigationMenuComponent;