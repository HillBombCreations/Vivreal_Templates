import GroupsClient from "./client";

export const metadata = {
  title: "Groups | Vivreal",
  description:
    "Learn how Groups are organized and managed within Vivreal. Understand collaboration, permissions, and content isolation without external tools.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "Groups | Vivreal",
    description:
      "Learn how Groups are organized and managed within Vivreal. Understand collaboration, permissions, and content isolation without external tools.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Groups | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Groups | Vivreal",
    description:
     "Learn how Groups are organized and managed within Vivreal. Understand collaboration, permissions, and content isolation without external tools.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <GroupsClient />;
}