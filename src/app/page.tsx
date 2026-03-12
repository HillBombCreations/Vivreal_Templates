import Navbar from '@/components/Navigation/Navbar';
import { getSiteData } from '@/lib/api/siteData';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import EmailListComponent from '@/components/EmailListComponent';
import HeroSectionServer from './(site)/_components/HeroSectionServer';

export const dynamic = "force-dynamic";

const Index = async () => {
  const siteData = await getSiteData();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: siteData?.surface }}>
      <Navbar />
      <EmailListComponent />
      <HeroSectionServer />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;

export const generateMetadata = async () => {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || 'Home';
  const domain = siteData?.domainName || '';

  return {
    title: siteName,
    description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
    ...(domain && {
      openGraph: {
        title: siteName,
        description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
        url: `https://${domain}/`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: siteName,
        description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
      },
    }),
  };
};
