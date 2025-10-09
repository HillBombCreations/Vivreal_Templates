"use client";

import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import {
  ClipboardList,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  LineChart,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import GetStartedButton from '@/components/GetStartedButton';

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const OrderAnalytics = () => {
  const points: PointCardProps[] = [
    {
      title: "Track Order Volume",
      description:
        "Get real-time visibility into order activity across your store. Monitor volume and order statuses from one place.",
      icon: ClipboardList,
    },
    {
      title: "Identify Top Products",
      description:
        "See what's selling, what's not, and how your product mix is performing with built-in ranking and filtering tools.",
      icon: ShoppingCart,
    },
    {
      title: "Visualize Sales Trends",
      description:
        "Spot seasonal patterns, campaign spikes, and performance dips with interactive charts and visualizations.",
      icon: LineChart,
    },
    {
      title: "Track Revenue Growth",
      description:
        "Monitor revenue over time to measure performance, calculate ROI, and forecast future growth confidently.",
      icon: DollarSign,
    },
  ];

  return (
    <>
      <Head>
        <title>Order Analytics | Vivreal</title>
        <meta
          name="description"
          content="Unlock powerful insights into your ecommerce store. Vivreal's Order Analytics helps you monitor sales, products, and revenue all in real time using Stripe integration."
        />
        <link rel="canonical" href={'https://www.vivreal.io/features/order-analytics'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-green-100 px-5 md:px-0 py-10 rounded-xl order-2 w-full md:order-1 space-y-6 text-center mx-auto -mb-10">
            <h1
              className="w-full text-3xl md:text-5xl font-display font-bold tracking-tight animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              Ecommerce Insights. <span className="text-green-700">Simplified.</span>
            </h1>
            <p
              className="inline-block text-gray-800 max-w-4xl text-md md:text-lg animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              Vivreal&apos;s Stripe-powered Order Analytics makes it easy to monitor your store&apos;s performance, spot trends, and make smarter decisions without extra tools or complexity.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="OrderAnalytics" color="#15803D" />
            </div>
          </div>
          <div className="text-center">
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {points.map((point, index) => (
                <div
                  key={index}
                  className="rounded-xl transition-all text-center"
                >
                  <point.icon size={28} className="w-8 h-8 text-green-700 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                  <p className="text-sm text-gray-800">{point.description}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-col md:flex-row gap-12 py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Built-In Ecommerce Intelligence
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Whether you&apos;re a solo seller or managing a full-scale storefront, Order Analytics gives you the clarity to optimize your strategy and scale with precision.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Quickly identify your top-performing products and categories</li>
                <li>Compare campaigns and time periods to evaluate marketing ROI</li>
                <li>Use real-time data to guide pricing, promotions, and inventory planning</li>
              </ul>
            </div>
            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-green-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How Order Analytics Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <ClipboardList className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Sync with Stripe</h4>
                      <p className="text-sm text-gray-800">
                        Connect your Stripe account in seconds no complex setup or coding needed.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <TrendingUp className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Analyze Performance</h4>
                      <p className="text-sm text-gray-800">
                        Access real-time dashboards showing order counts, sales volume, and revenue breakdowns.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <DollarSign className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Optimize Growth</h4>
                      <p className="text-sm text-gray-800">
                        Use analytics to inform future campaigns, promotions, and product development.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-center bg-secondary/50 px-10 py-10 rounded-xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Power Your Store With Data
            </h2>
            <p className="text-gray-800 max-w-3xl mx-auto">
              With Order Analytics, your team gains the insights needed to make informed decisions, boost conversions, and drive meaningful growth all backed by your own data.
            </p>
          </div>
        </section>

        <CTASection page="OrderAnalytics" />
      </main>

      <Footer />
    </>
  );
};

export default OrderAnalytics;