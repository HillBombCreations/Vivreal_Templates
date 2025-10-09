import IntegrationsClient from "./client";

export const metadata = {
  title: "Integrations | Vivreal",
  description:
    "Learn how Integrations are managed within Vivreal. Understand collaboration, permissions, and content isolation without external tools.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "Integrations | Vivreal",
    description:
      "Learn how Integrations are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Integrations | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Integrations | Vivreal",
    description:
     "Learn how Integrations are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <IntegrationsClient />;
}