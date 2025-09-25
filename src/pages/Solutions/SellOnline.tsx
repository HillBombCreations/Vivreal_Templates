import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import {
  ShoppingCart,
  CreditCard,
  LayoutTemplate,
  BarChart2,
  Settings,
  TrendingUp,
  ReceiptText,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import GetStartedButton from "@/components/GetStartedButton";

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const SellOnline = () => {
  const points: PointCardProps[] = [
    {
      icon: ShoppingCart,
      title: "Custom Storefronts",
      description:
        "Build beautiful, content-rich shopping experiences tailored to your brand without sacrificing performance.",
    },
    {
      icon: CreditCard,
      title: "Stripe Integration",
      description:
        "Easily connect to Stripe to accept payments, manage transactions, and keep your checkout process secure.",
    },
    {
      icon: LayoutTemplate,
      title: "Flexible Product Content",
      description:
        "Manage products like content. Add videos, rich descriptions, testimonials, and more to enhance the buying journey.",
    },
    {
      icon: BarChart2,
      title: "Order Insights",
      description:
        "Track order volume, revenue trends, and customer behavior to make smarter business decisions.",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Sell Online | Vivreal Solutions</title>
        <meta
          name="description"
          content="Launch and grow your online store with Vivreal. Manage product content, accept Stripe payments, and get real-time insights all from one flexible platform."
        />
        <link rel="canonical" href={'https://www.vivreal.io/solutions/ecommerce'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-green-50 px-5 md:px-0 py-10 rounded-xl w-full text-center space-y-6 mx-auto -mb-10">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Sell Smarter with <span className="text-green-700">Vivreal</span>
            </h1>
            <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg">
              Power your eCommerce site with dynamic content, real-time data, and seamless Stripe payments built for business teams.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="SellOnline" color="green-700" />
            </div>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {points.map((point, index) => (
              <div key={index} className="rounded-xl transition-all text-center">
                <point.icon size={28} className="w-8 h-8 text-green-700 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                <p className="text-sm text-gray-800">{point.description}</p>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col md:flex-row gap-12 py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Your Store. Your Strategy.
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Vivreal gives you full control over your eCommerce experience from homepage to checkout. Create rich product pages, update promos instantly, and gain visibility into what's working all without a dev team.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Launch and scale your store without starting from scratch</li>
                <li>Use real-time insights to optimize your product strategy</li>
                <li>Keep content and commerce in perfect sync</li>
              </ul>
            </div>
            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-green-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How It Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Settings className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Connect Stripe</h4>
                      <p className="text-sm text-gray-800">
                        Use our built-in Stripe integration to accept payments, manage orders, and handle refunds securely.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <TrendingUp className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Optimize Your Store</h4>
                      <p className="text-sm text-gray-800">
                        Use content blocks and dynamic product pages to boost engagement and conversions.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <ReceiptText className="w-6 h-6 text-green-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Monitor & Grow</h4>
                      <p className="text-sm text-gray-800">
                        Track revenue, orders, and buyer trends to stay ahead and adapt fast as your business evolves.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Everything You Need to Sell Online
            </h2>
            <p className="text-gray-800 max-w-3xl mx-auto">
              From product pages to payment processing, Vivreal equips your team to launch fast, sell smart, and scale without the headaches of traditional eCommerce platforms.
            </p>
          </div>
        </section>

        <CTASection page="SellOnline" />
      </main>

      <Footer />
    </>
  );
};

export default SellOnline;