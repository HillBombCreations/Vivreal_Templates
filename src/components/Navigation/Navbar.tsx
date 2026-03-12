import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import NavigationMenuComponent from './NavigationMenu';
import MobileNavigationMenuClient from './MobileNavigationMenuClient';
import { NavigationData } from '@/types/Navigation';
import { getNavigationData } from '@/lib/api/navigation';
import { getSiteData } from '@/lib/api/siteData';
import { getSignedUrl } from '@/lib/api/media';

async function fetchNavItems(): Promise<NavigationData[]> {
  try {
    const data = await getNavigationData();
    return data.filter((item) => item.displayOnHeader);
  } catch (err) {
    console.error('Error fetching navigation items:', err);
    return [];
  }
}

const Navbar = async () => {
  const navItems = await fetchNavItems();
  const siteData = await getSiteData();

  const siteName = siteData?.businessInfo?.name || siteData?.name || '';
  const logoUrl = getSignedUrl(siteData?.logo) || '/logo.png';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out pt-4 pb-1 md:pt-5 bg-white/90 backdrop-blur-sm">
      <div className="w-full px-4">
        <MobileNavigationMenuClient navItems={navItems} logoUrl={logoUrl} siteName={siteName} />

        <div className="hidden md:flex items-center relative justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src={logoUrl}
                alt={siteName || 'Site logo'}
                width={70}
                height={70}
                className="object-contain"
              />
              {siteName && (
                <span className="text-2xl font-semibold text-gray-900 font-brand leading-none">
                  {siteName}
                </span>
              )}
            </Link>
          </div>

          <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <NavigationMenuComponent items={navItems} />
          </nav>

          <div className="flex items-center space-x-3">
            <Link href="/review">
              <Button
                variant="outline"
                size="sm"
                className="font-medium cursor-pointer border-current"
                style={{ color: siteData?.primary }}
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
