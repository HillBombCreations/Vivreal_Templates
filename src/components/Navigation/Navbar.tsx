import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/Button";
import NavigationMenuComponent from './NavigationMenu';
import MobileNavigationMenuClient from './MobileNavigationMenuClient';
import { NavigationData } from "@/types/Navigation";
import { getHeroSectionData } from "@/lib/api/navigation";
import { siteData } from '@/data/mockData';

async function fetchNavItems(): Promise<NavigationData[]> {
  try {
    const data = await getHeroSectionData();
    const headerItems = data.filter((item) => item.displayOnHeader);
    return headerItems;
  } catch (err) {
    console.error("Error fetching navigation items:", err);
    return [];
  }
}

const Navbar = async () => {
  const navItems = await fetchNavItems();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out pt-4 pb-1 md:pt-5 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4">
        <MobileNavigationMenuClient navItems={navItems} />

        {/* Desktop navbar layout */}
        <div className="hidden md:flex items-center relative justify-between">
          {/* Left: Logo + Text */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/comedycollectiveLogo.png"
                alt="The Comedy Collective Logo"
                width={70}
                height={70}
              />
              <span className="text-2xl font-semibold text-gray-900 font-brand leading-none">
                The Comedy Collective
              </span>
            </Link>
          </div>

          {/* Center: Navigation (absolutely centered) */}
          <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <NavigationMenuComponent items={navItems} />
          </nav>

          {/* Right: Button(s) */}
          <div className="flex items-center space-x-3">
            <Link href="/review">
              <Button
                variant="outline"
                size="sm"
                style={{ color: siteData?.primary, borderColor: siteData?.primary }}
                className="font-medium cursor-pointer"
              >
                Leave A Review
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;