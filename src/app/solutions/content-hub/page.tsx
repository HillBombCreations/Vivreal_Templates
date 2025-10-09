import ContentHubClient from "./client";

export const metadata = {
  title: "Content Hub | Vivreal Solutions",
  description:
    "Vivreal's Content Hub helps your team manage blogs, media, and all your digital assets in one place. Keep everything organized, updated, and ready to publish without the chaos.",
  alternates: {
    canonical: "https://www.vivreal.io/solutions/content-hub",
  },
  openGraph: {
    title: "Content Hub | Vivreal Solutions",
    description:
      "Vivreal's Content Hub helps your team manage blogs, media, and all your digital assets in one place. Keep everything organized, updated, and ready to publish without the chaos.",
    url: "https://www.vivreal.io/solutions/content-hub",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Content Hub | Vivreal Solutions",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Content Hub | Vivreal Solutions",
    description:
      "Vivreal's Content Hub helps your team manage blogs, media, and all your digital assets in one place. Keep everything organized, updated, and ready to publish without the chaos.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <ContentHubClient />;
}