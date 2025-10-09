import WebsitesClient from "./client";

export const metadata = {
  title: "Websites | Vivreal Solutions",
  description:
    "Manage your business website with ease using Vivreal's headless CMS. Update content faster, stay on brand, and free up your developers for high-impact work.",
  alternates: {
    canonical: "https://www.vivreal.io/solutions/website",
  },
  openGraph: {
    title: "Websites | Vivreal Solutions",
    description:
      "Manage your business website with ease using Vivreal's headless CMS. Update content faster, stay on brand, and free up your developers for high-impact work.",
    url: "https://www.vivreal.io/solutions/website",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Websites | Vivreal Solutions",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Websites | Vivreal Solutions",
    description:
      "Manage your business website with ease using Vivreal's headless CMS. Update content faster, stay on brand, and free up your developers for high-impact work.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <WebsitesClient />;
}