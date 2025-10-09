import SellOnlineClient from "./client";

export const metadata = {
  title: "Sell Online | Vivreal Solutions",
  description:
    "Launch and grow your online store with Vivreal. Manage product content, accept Stripe payments, and get real-time insights all from one flexible platform.",
  alternates: {
    canonical: "https://www.vivreal.io/solutions/sell-online",
  },
  openGraph: {
    title: "Sell Online | Vivreal Solutions",
    description:
      "Launch and grow your online store with Vivreal. Manage product content, accept Stripe payments, and get real-time insights all from one flexible platform.",
    url: "https://www.vivreal.io/solutions/sell-online",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Sell Online | Vivreal Solutions",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sell Online | Vivreal Solutions",
    description:
      "Launch and grow your online store with Vivreal. Manage product content, accept Stripe payments, and get real-time insights all from one flexible platform.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <SellOnlineClient />;
}