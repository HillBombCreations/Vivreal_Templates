import FeaturesPageWrapper from "@/components/FeaturesPage/wrapper";

const KeyFeaturesPage = () => {
  return (
    <FeaturesPageWrapper />
  );
};

export const generateMetadata = async () => {
  return {
    title: "Vivreal - Features",
    description: "Our features are designed to help you manage your content efficiently and effectively.",
    openGraph: {
      title: "Vivreal - Features",
      description: "Our features are designed to help you manage your content efficiently and effectively.",
      url: "https://vivreal.io/",
      images:  [
        {
            url: new URL("/featuresMeta.png", "https://vivreal.io"),
            width: 1200,
            height: 630,
            alt: "Vivreal - Features",
        },
    ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal - Features",
      description: "Our features are designed to help you manage your content efficiently and effectively.",
      images: [new URL("/featuresMeta.png", "https://vivreal.io")]
    },
  };
}

export default KeyFeaturesPage;