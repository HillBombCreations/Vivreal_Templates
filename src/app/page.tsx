import { Suspense } from 'react';
import Navbar from '@/components/Navigation/Navbar';
import { getSiteData, getPageCollectionId, getPageLabel } from '@/lib/api/siteData';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import EmailListComponent from '@/components/EmailListComponent';
import HeroSectionServer from './(site)/_components/HeroSectionServer';
import HighlightsSection from '@/components/HighlightsSection';
import Testimonials from '@/components/Testimonials';
import { getReviews } from '@/lib/api/review';
import { getShows } from '@/lib/api/shows';
import { getTeamMembers } from '@/lib/api/team';
import { getPartners } from '@/lib/api/partners';

export const dynamic = "force-dynamic";

const Index = async () => {
  const siteData = await getSiteData();

  // Data for highlights
  const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
  const [shows, members, partners] = await Promise.all([
    getShows(showsCollectionId),
    getTeamMembers(),
    getPartners(),
  ]);

  // Subscribers
  const subscribersCollectionId = getPageCollectionId(siteData, "subscribers", "");

  // Reviews
  const reviewsCollectionId = getPageCollectionId(siteData, "review", "");
  const reviews = await getReviews(reviewsCollectionId);
  const reviewsHeading = getPageLabel(siteData, "review", "heading", "What People Are Saying");

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: siteData?.surface }}>
      <Navbar />
      <EmailListComponent collectionId={subscribersCollectionId} />
      <HeroSectionServer />
      <HighlightsSection
        siteData={siteData}
        showCount={shows.length}
        memberCount={members.length}
        venueCount={partners.length}
      />
      {reviews.length > 0 && (
        <Suspense fallback={null}>
          <Testimonials reviews={reviews} siteData={siteData} heading={reviewsHeading} />
        </Suspense>
      )}
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
