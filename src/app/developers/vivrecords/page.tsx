import VivRecordsClient from "./client";

export const metadata = {
  title: "VivRecords | Vivreal",
  description:
    "Learn how VivRecords are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "VivRecords | Vivreal",
    description:
      "Learn how VivRecords are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "VivRecords | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VivRecords | Vivreal",
    description:
     "Learn how VivRecords are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <VivRecordsClient />;
}