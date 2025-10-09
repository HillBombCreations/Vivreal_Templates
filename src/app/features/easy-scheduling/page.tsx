import EasySchedulingClient from "./client";

export const metadata = {
  title: "Easy Scheduling | Vivreal Features",
  description:
    "Plan and automate your content releases with Vivreal's Easy Scheduling feature. Stay ahead of deadlines and ensure timely go-lives without the last-minute stress.",
  alternates: {
    canonical: "https://www.vivreal.io/features/easy-scheduling",
  },
  openGraph: {
    title: "Easy Scheduling | Vivreal Features",
    description:
      "Plan and automate your content releases with Vivreal's Easy Scheduling feature. Stay ahead of deadlines and ensure timely go-lives without the last-minute stress.",
    url: "https://www.vivreal.io/features/easy-scheduling",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Easy Scheduling | Vivreal Features",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Easy Scheduling | Vivreal Features",
    description:
      "Plan and automate your content releases with Vivreal's Easy Scheduling feature. Stay ahead of deadlines and ensure timely go-lives without the last-minute stress.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <EasySchedulingClient />;
}