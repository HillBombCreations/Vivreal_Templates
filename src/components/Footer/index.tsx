import Link from "next/link";
import Image from 'next/image';
import { NavigationData } from "@/types/Navigation";
import { getNavigationData } from "@/lib/api/navigation";
import { getSiteData } from "@/lib/api/siteData";
import { mediaCdnUrl } from "@/lib/api/media";

async function fetchNavigationData(): Promise<NavigationData[]> {
  try {
    return await getNavigationData();
  } catch (err) {
    console.error("Error fetching navigation items:", err);
    return [];
  }
}

const Footer = async () => {
  const navItems = await fetchNavigationData();
  const siteData = await getSiteData();
  const currentYear = new Date().getFullYear();

  const siteName = siteData?.businessInfo?.name || siteData?.name || '';
  const logoUrl = siteData?.logo?.currentFile?.source || mediaCdnUrl(siteData?.logo?.key) || '/logo.png';
  const socialLinks = siteData?.socialLinks ?? [];

  return (
    <footer className="py-12 md:py-16 bg-secondary/50">
      <div className="content-grid">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-full md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <Image src={logoUrl} alt={siteName || 'Logo'} width={175} height={175} className="object-contain" />
            </Link>
            {siteData?.businessInfo?.contactInfo?.email && (
              <p className="text-sm text-gray-800 mb-6 max-w-xs">
                <a href={`mailto:${siteData.businessInfo.contactInfo.email}`} className="hover:underline">
                  {siteData.businessInfo.contactInfo.email}
                </a>
              </p>
            )}
            {socialLinks.length > 0 && (
              <div className="flex space-x-4">
                {socialLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-800 hover:text-foreground transition-colors text-sm font-medium"
                  >
                    {link.platform}
                  </a>
                ))}
              </div>
            )}
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
            &copy; {currentYear} {siteName}. All rights reserved.{' '}
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
