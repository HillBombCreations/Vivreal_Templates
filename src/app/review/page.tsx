import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import ReviewClient from './ReviewClient';
import { getSiteData } from '@/lib/api/siteData';

const ReviewPage = () => {
  return (
    <>
      <Navbar />
      <ReviewClient />
      <Footer />
    </>
  );
};

export default ReviewPage;

export const generateMetadata = async () => {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  return {
    title: `Leave a Review | ${siteName}`,
    description: `Share your experience with ${siteName}. We'd love to hear from you!`,
  };
};
