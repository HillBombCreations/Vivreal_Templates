// app/components/MobileNavigationMenuClient.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { NavigationData } from "@/types/Navigation";
import MobileNavigationMenu from "./MobileNavigationMenu";
import { SiteData } from "@/types/SiteData";

interface Props {
  navItems: NavigationData[];
  siteData: SiteData
}

const MobileNavigationMenuClient = ({ navItems, siteData }: Props) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="flex md:hidden items-center justify-between">
        <Link href="/" className="flex-1 text-start items-center inline-flex space-x-2">
          <img
            src={siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png"}
            alt={siteData?.name || "ecommerce site"}
            width={60}
            height={60}
            className="inline-block"
          />
          <span style={{ color: siteData?.siteDetails?.["text-primary"] }} className="text-2xl font-semibold font-brand leading-none">
            {siteData?.name}
          </span>
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
          siteData={siteData}
          handleClose={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default MobileNavigationMenuClient;
