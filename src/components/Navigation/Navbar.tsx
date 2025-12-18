import Link from 'next/link';
import { Button } from "@/components/ui/Button";
import NavigationMenuComponent from './NavigationMenu';
import MobileNavigationMenuClient from './MobileNavigationMenuClient';
import { SiteData } from '@/types/SiteData';


const Navbar = ({ siteData }: {siteData: SiteData}) => {
  const navItems = [
    {
      "path": "/",
      "label": "Home",
      "displayOnHeader": true,
    },
    {
      "path": "/products",
      "label": "Products",
      "displayOnHeader": true,
    }
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out pt-4 pb-1 md:pt-5 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4">
        <MobileNavigationMenuClient navItems={navItems} siteData={siteData}/>
        <div className="hidden md:flex items-center relative justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <img
                src={siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png"}
                alt={`${siteData?.name || "Site"} Logo`}
                width={70}
                height={70}
              />
              <span className="text-2xl font-semibold text-gray-900 font-brand leading-none">
                {siteData?.name}
              </span>
            </Link>
          </div>

          <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <NavigationMenuComponent items={navItems} siteData={siteData} />
          </nav>

          <div className="flex items-center space-x-3">
            <Link href="/review">
              <Button
                variant="outline"
                size="sm"
                style={{ color: siteData?.siteDetails?.primary, borderColor: siteData?.siteDetails?.primary }}
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