import DataAnlayticsClient from "./client";

export const metadata = {
  title: "Data Analytics | Vivreal Features",
  description:
    "Get full visibility into your content and team activity with Vivreal's built-in analytics. Understand performance, usage, and growth without external tools.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "Data Analytics | Vivreal Features",
    description:
      "Get full visibility into your content and team activity with Vivreal's built-in analytics. Understand performance, usage, and growth without external tools.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Data Analytics | Vivreal Features",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Data Analytics | Vivreal Features",
    description:
      "Get full visibility into your content and team activity with Vivreal's built-in analytics. Understand performance, usage, and growth without external tools.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <DataAnlayticsClient />;
}