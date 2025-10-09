import QuickUpdatesClient from "./client";

export const metadata = {
  title: "Quick Updates | Vivreal Features",
  description:
    "Update your content instantly with Vivreal's intuitive editing tools. Empower business teams to move faster and keep your brand relevant without needing developer help.",
  alternates: {
    canonical: "https://www.vivreal.io/features/quick-updates",
  },
  openGraph: {
    title: "Quick Updates | Vivreal Features",
    description:
      "Update your content instantly with Vivreal's intuitive editing tools. Empower business teams to move faster and keep your brand relevant without needing developer help.",
    url: "https://www.vivreal.io/features/quick-updates",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Quick Updates | Vivreal Features",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quick Updates | Vivreal Features",
    description:
      "Update your content instantly with Vivreal's intuitive editing tools. Empower business teams to move faster and keep your brand relevant without needing developer help.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <QuickUpdatesClient />;
}