import LandingPageWrapper from '@/components/LandingPage/wrapper';
import { getArticles } from "@/lib/api/developers";
import {
    getHeroSectionData,
    getTeamSyncData,
    getFeatureGifSectionData,
    getSolutionsSectionData,
    getFeaturesSectionData,
    getWhatWeDoSectionData
} from '@/lib/api/landing';

const Index = async () => {
    const articleSectionData = await getArticles();
    const heroSectionDataRaw = await getHeroSectionData();
    const teamSyncDataRaw = await getTeamSyncData();
    const featureGifSectionData = await getFeatureGifSectionData();
    const solutionsSectionData = await getSolutionsSectionData();
    const featuresSectionData = await getFeaturesSectionData();
    const whatWeDoSectionData = await getWhatWeDoSectionData();
    return (
        <div>
            <LandingPageWrapper
                articleSectionData={articleSectionData}
                heroSectionData={heroSectionDataRaw}
                teamSyncData={teamSyncDataRaw}
                featureGifSectionData={featureGifSectionData}
                solutionsSectionData={solutionsSectionData}
                featuresSectionData={featuresSectionData}
                whatWeDoSectionData={whatWeDoSectionData}
            />
        </div>
    );
};

export default Index;

export const generateMetadata = async () => {
  return {
    title: "Vivreal CMS - Powerful Content Management Without the Cost",
    description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
    openGraph: {
      title: "Vivreal CMS - Powerful Content Management Without the Cost",
      description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
      url: "https://vivreal.io/",
      images:  [
        {
            url: new URL("/heroImage.png", "https://vivreal.io"),
            width: 1200,
            height: 630,
            alt: "Vivreal CMS - Powerful Content Management Without the Cost",
        },
    ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal CMS - Powerful Content Management Without the Cost",
      description: "Vivreal helps teams manage structured content efficiently with affordable, developer-friendly tools.",
      images: [new URL("/heroImage.png", "https://vivreal.io")]
    },
  };
}