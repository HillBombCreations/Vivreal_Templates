import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { getShows } from "@/lib/api/shows";
import ShowPageClient from "./ShowPageClient";

// Force runtime fetching instead of static build
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MediaPage() {
  const mediaData = await getShows();
  console.log("Media Data:", mediaData);
  const items = mediaData || [];

  return (
    <>
      <Navbar />
      <ShowPageClient items={items} />
      <CTASection />
      <Footer />
    </>
  );
};

export async function generateMetadata() {
  return {
    title: "Media Hub",
    description:
      "Explore our media hub: articles, videos, and podcasts featuring insights, stories, and conversations for creators, teams, and innovators.",
    openGraph: {
      title: "Media Hub",
      description:
        "Explore our media hub: articles, videos, and podcasts featuring insights, stories, and conversations for creators, teams, and innovators.",
      url: "https://comedycollectivechi.com/media",
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