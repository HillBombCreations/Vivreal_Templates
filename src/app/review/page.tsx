import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import ReviewClient from './ReviewClient';

const ReviewPage = () => {

  return (
    <>
      <Head>
        <title>Leave a Review | The Comedy Collective</title>
        <meta
          name="description"
          content="Share your thoughts about The Comedy Collective! Leave a review and let us know what you loved about your experience."
        />
        <link rel="canonical" href={'https://comedycollectivechi.com/review'} />
      </Head>
      <Navbar />
      <ReviewClient />
      <Footer />
    </>
  );
};

export default ReviewPage;

export const generateMetadata = async () => {
  return {
    title: "Leave a Review | The Comedy Collective",
    description:
      "Tell us how we did! Share your feedback and help others discover The Comedy Collective experience.",
    openGraph: {
      title: "Leave a Review | The Comedy Collective",
      description:
        "We’d love to hear from you! Share your experience with The Comedy Collective and help spread the laughter.",
      url: "https://comedycollectivechi.com/review",
      images: [
        {
          url: "/review-meta.png",
          width: 1200,
          height: 630,
          alt: "The Comedy Collective Reviews",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Leave a Review | The Comedy Collective",
      description:
        "Loved your time with The Comedy Collective? Leave a review and let us know what made you laugh!",
      images: ["/review-meta.png"],
    },
  };
};