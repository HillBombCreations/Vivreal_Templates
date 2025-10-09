import SolutionsPageWrapper from "@/components/SolutionsPage/wrapper";

const SolutionsPage = () => {
  return (
    <SolutionsPageWrapper />
  );
};

export const generateMetadata = async () => {
    return {
    title: "Vivreal - Solutions",
    description: "Discover how Vivreal helps businesses launch websites faster, centralize content, reach customers across channels, and sell online with ease.",
    openGraph: {
      title: "Vivreal - Solutions",
      description: "Solve business challenges with Vivreal. Build flexible websites, manage content in one hub, deliver across channels, and grow online sales.",
      url: "https://vivreal.io/solutions",
      images: [
        {
          url: new URL("/solutionsMeta.png", "https://vivreal.io"),
          width: 1200,
          height: 630,
          alt: "Vivreal - Solutions",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal - Solutions",
      description: "Vivreal helps you streamline content, engage customers, and drive growth — all from one platform.",
      images: [
        new URL("/solutionsMeta.png", "https://vivreal.io"),
      ],
    },
  }
};

export default SolutionsPage;