"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NavigationMenuComponent from "./NavigationMenu";
import { SiteData } from "@/types/SiteData";
import { useCartContext } from "@/contexts/CartContext";
import CartDialog from "./CartDialog";
import { ShoppingCart } from "lucide-react";

const Navbar = ({ siteData, originUrl }: { siteData: SiteData, originUrl: string }) => {
  const { cart, openCartMenu, setOpenCartMenu } = useCartContext();
  const navItems = useMemo(
    () => [
      { path: "/", label: "Home", displayOnHeader: true },
      { path: "/products", label: "Products", displayOnHeader: true },
    ],
    []
  );

  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let quantity = 0;

    if (cart) {
      for (const [, item] of Object.entries(cart)) {
        quantity += item.quantity ?? 0;
      }
    }

    setCartCount(quantity);
  }, [cart]);

  const primary = siteData?.siteDetails?.primary;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out pt-4 pb-4 bg-white/90 backdrop-blur-sm">
        <div className="w-full px-4">
          <div className="flex items-center relative justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <img
                  src={siteData?.siteDetails?.logo?.imageUrl || "/vrLogo.png"}
                  alt={`${siteData?.name || "Site"} Logo`}
                  width={40}
                  height={40}
                />
                <span
                  style={{ color: primary }}
                  className="hidden md:flex text-2xl font-semibold text-gray-900 font-brand leading-none"
                >
                  {siteData?.name}
                </span>
              </Link>
            </div>

            <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
              <NavigationMenuComponent items={navItems} siteData={siteData} />
            </nav>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setOpenCartMenu(true)}
                className="relative cursor-pointer inline-flex items-center justify-center h-9 w-9 rounded-md bg-white/40 hover:bg-white/70 transition"
                style={{ color: primary }}
                aria-label="Open cart"
              >
                <ShoppingCart className="h-6 w-6" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] leading-[18px] text-white bg-red-500 text-center">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>
      <CartDialog open={openCartMenu} originUrl={originUrl} onClose={() => setOpenCartMenu(false)} siteData={siteData} />
    </>
  );
};

export default Navbar;