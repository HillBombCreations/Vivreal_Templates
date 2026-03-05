import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { getShows } from "@/lib/api/shows";
import ShowPageClient from "./ShowPageClient";

// Force runtime fetching instead of static build
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MediaPage() {
  const shows = await getShows();
  
  let upcomingShows: typeof shows = [];
  let pastShows: typeof shows = [];
  
  if (shows && Array.isArray(shows)) {
    const today = new Date();
    
    upcomingShows = shows.filter(show => {
      if (!show.date) return false;
      const showDate = new Date(show.date);
      return showDate >= today;
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
    
    pastShows = shows.filter(show => {
      if (!show.date) return false;
      const showDate = new Date(show.date);
      return showDate < today;
    }).sort((a, b) => {
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }


  return (
    <>
      <Navbar />
      <ShowPageClient upcomingShows={upcomingShows} pastShows={pastShows} />
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