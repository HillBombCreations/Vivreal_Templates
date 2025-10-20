import Link from "next/link";
import Image from 'next/image';
import { NavigationData } from "@/types/Navigation";
import { getHeroSectionData } from "@/lib/api/navigation";
import { getSiteData } from "@/lib/api/landing";

const InstagramIcon = () => (
  <Image
    src="/instagramLogo.png"
    alt="Instagram Logo"
    width={20}
    height={20}
    className="h-[20px] w-[20px]"
  />
);

async function fetchNavigationDatas(): Promise<NavigationData[]> {
  try {
    const data = await getHeroSectionData();
    return data;
  } catch (err) {
    console.error("Error fetching navigation items:", err);
    return [];
  }
};

const Footer = async () => {
  const navItems = await fetchNavigationDatas();
  const siteData = await getSiteData();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 md:py-16 bg-secondary/50">
      <div className="content-grid">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-full md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <Image src="/comedycollectiveLogo.png" alt="The Comedy Collective" width={175} height={175} />
            </Link>
            <p className="text-sm text-gray-800 mb-6 max-w-xs">
             The Comedy Collective is Chicago&apos;s newest and hungriest comedy company. Monthly shows at the Den Theatre and more to come!
            </p>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/comedycollective1" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground pt-1 transition-colors">
                <InstagramIcon />
              </a>
            </div>
          </div>
          <div className="col-span-full md:col-span-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {navItems.map((item) => (
                <Link
                  href={item.path}
                  key={item.path}
                  className="text-sm font-medium text-gray-800 hover:underline"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-8 pb-8">
          <p className="text-sm text-gray-800 text-center">
            © {currentYear} {siteData?.businessInfo?.name}. All rights reserved.{' '}
            <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>{' | '}
            <a href="/terms" className="underline hover:text-blue-600">Terms of Use</a>
          </p>
        </div>
        <div className="flex items-center justify-center">
          <a
            href="https://vivreal.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            <Image
              src="/vrlogo.png"
              alt="Vivreal Logo"
              width={16}
              height={16}
              className="opacity-80"
            />
            <span className="text-xs md:text-sm text-gray-600">
              Powered by <span className="font-medium text-gray-800">Vivreal</span>
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;