import Link from "next/link";
import Image from 'next/image';
import { SiteData } from '@/types/SiteData';

const Footer = ({ siteData }: {siteData: SiteData}) => {
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
  ];

  const SOCIAL_ICON_MAP: Record<string, string> = {
    instagram: "/social/instagram.png",
    facebook: "/social/facebook.png",
    x: "/social/x.png",
    linkedin: "/social/linkedin.png",
    youtube: "/social/youtube.png",
    pinterest: "/social/pinterest.png",
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 md:py-16 bg-secondary/50">
      <div className="content-grid">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-full md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <img src={siteData?.siteDetails?.logo?.imageUrl} alt={siteData?.name} width={175} height={175} />
            </Link>
            <p className="text-sm text-gray-800 mb-6 max-w-xs">
             {siteData?.name} is an online store that is powered through Vivreal.
            </p>
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
        {siteData?.socialLinks?.length > 0 && (
          <div className="flex items-center justify-center gap-4 mb-6">
            {siteData.socialLinks.map((social) => {
              const iconSrc = SOCIAL_ICON_MAP[social.type.toLowerCase()];
              if (!iconSrc || !social.link) return null;

              return (
                <a
                  key={social.type}
                  href={social.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-80 hover:opacity-100 transition-opacity"
                  aria-label={social.type}
                >
                  <Image
                    src={iconSrc}
                    alt={`${social.type} icon`}
                    width={20}
                    height={20}
                  />
                </a>
              );
            })}
          </div>
        )}
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