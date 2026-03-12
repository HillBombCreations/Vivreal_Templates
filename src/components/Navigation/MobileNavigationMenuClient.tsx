"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { NavigationData } from "@/types/Navigation";
import MobileNavigationMenu from "./MobileNavigationMenu";

interface Props {
  navItems: NavigationData[];
  logoUrl: string;
  siteName: string;
}

const MobileNavigationMenuClient = ({ navItems, logoUrl, siteName }: Props) => {
  const siteData = useSiteData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="flex md:hidden items-center justify-between">
        <Link href="/" className="flex-1 text-start items-center inline-flex space-x-2">
          <Image src={logoUrl} alt={siteName || 'Logo'} width={60} height={60} className="inline-block object-contain" />
          {siteName && (
            <span style={{ color: siteData?.["text-primary"] }} className="text-2xl font-semibold font-brand leading-none">
              {siteName}
            </span>
          )}
        </Link>
        <button
          className="p-2"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </div>
      <hr className="md:hidden mt-1" />

      {mobileMenuOpen && (
        <MobileNavigationMenu
          items={navItems}
          open={mobileMenuOpen}
          handleClose={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default MobileNavigationMenuClient;
