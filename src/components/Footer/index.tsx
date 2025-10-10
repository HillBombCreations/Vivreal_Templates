import Link from "next/link";
import Image from 'next/image';
import { NavigationData } from "@/types/Navigation";
import { getHeroSectionData } from "@/lib/api/navigation";

const DiscordIcon = () => (
  <Image
    src="/discordLogo.svg"
    alt="Discord Logo"
    width={20}
    height={20}
    className="h-[20px] w-[20px]"
  />
);

const RedditIcon = () => (
  <Image
    src="/redditLogo.svg"
    alt="Reddit Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const XIcon = () => (
  <Image
    src="/xLogo.png"
    alt="X Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const LinkedInIcon = () => (
  <Image
    src="/linkedInLogo.png"
    alt="LinkedIn Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
  />
);

const FacebookIcon = () => (
  <Image
    src="/facebookLogo.png"
    alt="Meta Logo"
    width={20}
    height={20}
    className="h-auto w-[20px]"
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
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 md:py-16 bg-secondary/50">
      <div className="content-grid">
        <div className="grid md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-full md:col-span-2">
            <Link href="/" className="flex items-center mb-4">
              <Image src="/vivreallogo.svg" alt="Vivreal" width={128} height={32} className="h-8" />
            </Link>
            <p className="text-sm text-gray-800 mb-6 max-w-xs">
              A powerful headless CMS platform that gives developers and content creators the freedom to build and deploy exceptional digital experiences.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.linkedin.com/company/vivreal" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground pt-1 transition-colors">
                <LinkedInIcon />
              </a>
              <a href="https://x.com/Vivreal_io" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <XIcon />
              </a>
              <a href="https://www.facebook.com/vivreal.cms" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <FacebookIcon />
              </a>
              <a href="https://www.reddit.com/r/Vivreal" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <RedditIcon />
              </a>
              <a href="https://discord.gg/8vr5vK3C" target="_blank" rel="noopener noreferrer" className="text-gray-800 hover:text-foreground transition-colors">
                <DiscordIcon />
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
        <div className="border-t border-border pt-8">
          <p className="text-sm text-gray-800 text-center">
            © {currentYear} Vivreal. All rights reserved.{' '}
            <a href="/privacy" className="underline hover:text-blue-600">Privacy Policy</a>{' | '}
            <a href="/terms" className="underline hover:text-blue-600">Terms of Use</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;