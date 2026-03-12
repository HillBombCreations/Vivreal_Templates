import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { getShows } from "@/lib/api/shows";
import { getSiteData } from "@/lib/api/siteData";
import ShowPageClient from "./ShowPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ContentPage() {
  const shows = await getShows();

  let upcomingShows: typeof shows = [];
  let pastShows: typeof shows = [];

  if (shows && Array.isArray(shows)) {
    const today = new Date();

    upcomingShows = shows
      .filter((show) => show.date && new Date(show.date) >= today)
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

    pastShows = shows
      .filter((show) => show.date && new Date(show.date) < today)
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  }

  return (
    <>
      <Navbar />
      <ShowPageClient upcomingShows={upcomingShows} pastShows={pastShows} />
      <CTASection />
      <Footer />
    </>
  );
}

export async function generateMetadata() {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  return {
    title: `Content | ${siteName}`,
    description: `Browse all content from ${siteName} — upcoming events, past highlights, and more.`,
  };
}
