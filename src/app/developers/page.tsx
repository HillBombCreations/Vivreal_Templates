import { ArticleData } from "@/types/Articles"
import { getArticles } from "@/lib/api/developers";
import DevelopersPageWrapper from "@/components/Developers/wrapper";

const DevelopersPage = async () => {
  const articlePageData = await getArticles();
  const articles: ArticleData[] = articlePageData?.carouselData || [];

  return (
   <DevelopersPageWrapper { ...articles } />
  );
};

export const generateMetadata = async () => {
  return {
    title: "Vivreal - Developers",
    description: "Resources for developers: documentation, articles, groups, VivRecords, user seats, and integrations to help you build with Vivreal.",
    openGraph: {
      title: "Vivreal - Developers",
      description: "Access developer resources including documentation, technical articles, groups, VivRecords, user seats, and integrations for Vivreal.",
      url: "https://vivreal.io/developers",
      images: [
        {
          url: new URL("/developersMeta.png", "https://vivreal.io"),
          width: 1200,
          height: 630,
          alt: "Vivreal - Developers",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal - Developers",
      description: "Developer resources for Vivreal: documentation, articles, groups, VivRecords, user seats, and integrations.",
      images: [
        new URL("/developersMeta.png", "https://vivreal.io"),
      ],
    },
  }
}

export default DevelopersPage;