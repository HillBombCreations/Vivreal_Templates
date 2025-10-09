import React from 'react';
import PricingPageWrapper from '@/components/PricingPage/wrapper';

const Pricing = () => {

  return (
    <PricingPageWrapper />
  );
};

export default Pricing;

export const generateMetadata = async () => {
  return {
    title: "Vivreal CMS - Explore our pricing options",
    description: "Whether you're a small business or a large enterprise, Vivreal has a plan that fits your needs and budget.",
    openGraph: {
      title: "Vivreal CMS - Explore our pricing options",
      description: "Whether you're a small business or a large enterprise, Vivreal has a plan that fits your needs and budget.",
      url: "https://vivreal.io/",
      images:  [
        {
            url: new URL("/pricing.png", "https://vivreal.io"),
            width: 1200,
            height: 630,
            alt: "Vivreal CMS - Explore our pricing options",
        },
    ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal CMS - Explore our pricing options",
      description: "Whether you're a small business or a large enterprise, Vivreal has a plan that fits your needs and budget.",
      images: [new URL("/pricing.png", "https://vivreal.io")]
    },
  };
}
