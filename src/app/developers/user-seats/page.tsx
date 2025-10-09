import UserSeatsClient from "./client";

export const metadata = {
  title: "User Seats | Vivreal",
  description:
    "Learn how User Seats are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
  alternates: {
    canonical: "https://www.vivreal.io/features/data-analytics",
  },
  openGraph: {
    title: "User Seats | Vivreal",
    description:
      "Learn how User Seats are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    url: "https://www.vivreal.io/features/data-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "User Seats | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "User Seats | Vivreal",
    description:
     "Learn how User Seats are measured and kept track of within Vivreal. Understand performance, usage, and growth without external tools.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <UserSeatsClient />;
}