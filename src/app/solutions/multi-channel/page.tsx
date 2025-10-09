import MultiChannelClient from "./client";

export const metadata = {
  title: "Multi-Channel Marketing | Vivreal Solutions",
  description:
    "Deliver your message everywhere fast. Vivreal helps marketing teams launch cross-channel campaigns, stay on brand, and move faster with less effort.",
  alternates: {
    canonical: "https://www.vivreal.io/solutions/multi-channel",
  },
  openGraph: {
    title: "Multi-Channel Marketing | Vivreal Solutions",
    description:
      "Deliver your message everywhere fast. Vivreal helps marketing teams launch cross-channel campaigns, stay on brand, and move faster with less effort.",
    url: "https://www.vivreal.io/solutions/multi-channel",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Multi-Channel Marketing | Vivreal Solutions",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Multi-Channel Marketing | Vivreal Solutions",
    description:
      "Deliver your message everywhere fast. Vivreal helps marketing teams launch cross-channel campaigns, stay on brand, and move faster with less effort.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <MultiChannelClient />;
}