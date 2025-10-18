"use client";

import Link from "next/link";
import { usePathname } from "next/navigation"; // ✅ Detects active route
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLinkTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import { NavigationData } from "@/types/Navigation";
import { siteData } from "@/data/mockData";

interface NavigationMenuProps {
  items: NavigationData[];
}

const NavigationMenuComponent: React.FC<NavigationMenuProps> = ({ items }) => {
  const pathname = usePathname(); // current URL path

  return (
    <>
      <style jsx global>{`
        /* --- Hover underline animation --- */
        .nav-link {
          position: relative;
          transition: color 0.3s ease, transform 0.3s ease;
        }

        .nav-link::after {
          content: "";
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0%;
          height: 2px;
          background-color: ${siteData.primary};
          transition: width 0.3s ease;
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .nav-link:hover {
          color: ${siteData.primary};
          transform: translateY(-1px);
        }

        /* --- Active state --- */
        .nav-link.active {
          color: ${siteData.primary};
          font-weight: 600;
        }

        .nav-link.active::after {
          width: 100%;
        }
      `}</style>

      <NavigationMenu className="relative">
        <NavigationMenuList>
          {items.map((item, idx) => {
            const isActive =
              pathname === item.path ||
              (pathname.startsWith(item.path) && item.path !== "/");

            return (
              <NavigationMenuItem
                key={`nav-menu-${item.label}-${idx}`}
                className="relative group"
              >
                <NavigationMenuLinkTrigger asChild>
                  <Link
                    href={item.path}
                    className={`nav-link text-base font-medium px-3 py-2 ${
                      isActive ? "active" : "text-gray-800"
                    }`}
                  >
                    {item.label}
                  </Link>
                </NavigationMenuLinkTrigger>
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