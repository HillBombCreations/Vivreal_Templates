import DocumentationClient from "./client";

export const metadata = {
  title: "Documentation | Vivreal",
  description:
    "Checkout our Documentation to get started with Vivreal. Learn how to set up, configure, and use Vivreal's features effectively.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "Documentation | Vivreal",
    description:
      "Learn how to set up, configure, and use Vivreal's features effectively.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Documentation | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation | Vivreal",
    description:
     "Learn how to set up, configure, and use Vivreal's features effectively.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <DocumentationClient />;
}