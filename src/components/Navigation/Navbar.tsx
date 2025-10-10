import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/UI/Button";
import NavigationMenuComponent from './NavigationMenu';
import MobileNavigationMenuClient from './MobileNavigationMenuClient'
import { NavigationData } from "@/types/Navigation";
import { getHeroSectionData } from "@/lib/api/navigation";

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
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out py-4 md:py-5">
      <div className="w-full px-4">
        <MobileNavigationMenuClient navItems={navItems} />
        <div className="hidden md:flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image
              src="/vivreallogo.svg"
              alt="Vivreal"
              width={128}
              height={32}
              className="h-8"
            />
          </Link>

          <nav className="flex items-center">
            <NavigationMenuComponent items={navItems} />
          </nav>

          <div className="flex items-center space-x-3">
            <Link href="/contact">
              <Button
                variant="outline"
                size="sm"
                className="font-medium cursor-pointer"
              >
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;