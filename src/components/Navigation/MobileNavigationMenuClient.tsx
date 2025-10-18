// app/components/MobileNavigationMenuClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import MobileNavigationMenu from "./MobileNavigationMenu";
import { NavigationData } from "@/types/Navigation";

interface Props {
  navItems: NavigationData[];
}

const MobileNavigationMenuClient = ({ navItems }: Props) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="flex md:hidden items-center justify-between">
        <Link href="/" className="flex-1 text-start">
          <Image src="/comedycollectiveLogo.png" alt="The Comedy Collective" width={60} height={60} className="inline-block" />
        </Link>
        <button
          className="p-2"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </div>

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
