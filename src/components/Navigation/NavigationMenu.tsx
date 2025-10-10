"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuLinkTrigger,
  NavigationMenuViewport,
} from "@/components/UI/navigation-menu";
import { NavigationData } from "@/types/Navigation";

interface NavigationMenuProps {
  items: NavigationData[];
}

const NavigationMenuComponent: React.FC<NavigationMenuProps> = ({ items }) => {
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
          {items.map((item, idx) => {
              return (
                <NavigationMenuItem key={`nav-menu-${item.label}-${idx}`} className="relative group">
                  <NavigationMenuLinkTrigger asChild>
                    <Link href={item.path}>{item.label}</Link>
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