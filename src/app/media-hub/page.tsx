import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { getArticles } from "@/lib/api/media-hub";
import MediaPageClient from "./MediaPageClient";

export const MediaPage = async () => {
  const mediaData = await getArticles();
  const items = mediaData?.carouselData || [];

  return (
    <>
      <Navbar />
      <MediaPageClient items={items} />
      <CTASection />
      <Footer />
    </>
  );
};

export default MediaPage;

export const generateMetadata = async () => {
  return {
    title: "Media Hub",
    description:
      "Explore our media hub: articles, videos, and podcasts featuring insights, stories, and conversations for creators, teams, and innovators.",
    openGraph: {
      title: "Media Hub",
      description:
        "Explore our media hub: articles, videos, and podcasts featuring insights, stories, and conversations for creators, teams, and innovators.",
      url: "https://example.com/media",
      images: [
        {
          url: "/media-thumbnail.png",
          width: 1200,
          height: 630,
          alt: "Media Hub Preview",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Media Hub",
      description:
        "Explore our media hub: articles, videos, and podcasts featuring insights, stories, and conversations for creators, teams, and innovators.",
      images: ["/media-thumbnail.png"],
    },
  };
};