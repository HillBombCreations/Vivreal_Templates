import OrderAnalyticsClient from "./client";

export const metadata = {
  title: "Order Analytics | Vivreal Features",
  description:
    "Unlock powerful insights into your ecommerce store. Vivreal's Order Analytics helps you monitor sales, products, and revenue all in real time using Stripe integration.",
  alternates: {
    canonical: "https://www.vivreal.io/features/order-analytics",
  },
  openGraph: {
    title: "Order Analytics | Vivreal Features",
    description:
      "Unlock powerful insights into your ecommerce store. Vivreal's Order Analytics helps you monitor sales, products, and revenue all in real time using Stripe integration.",
    url: "https://www.vivreal.io/features/order-analytics",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Order Analytics | Vivreal Features",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Order Analytics | Vivreal Features",
    description:
      "Unlock powerful insights into your ecommerce store. Vivreal's Order Analytics helps you monitor sales, products, and revenue all in real time using Stripe integration.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

export default function Page() {
  return <OrderAnalyticsClient />;
}