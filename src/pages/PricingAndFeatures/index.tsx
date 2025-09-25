import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Helmet } from 'react-helmet';

const PricingAndFeaturesPage = () => {
  return (
    <>
      <Helmet>
        <title>Vivreal Headless CMS | Pricing And Features</title>
        <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
      </Helmet>
      <Navbar />
      <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid">
          <div className="mx-auto text-center space-y-6">
            <div className="grid w-full md:grid-cols-2 gap-10 md:gap-16 items-center">
              <div className="order-2 text-start md:order-1 space-y-6">
                <span
                  className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary animate-fade-in"
                  style={{ animationDelay: '100ms' }}
                >
                  Simple, transparent pricing
                </span>
                <h1
                  className="text-4xl md:text-5xl font-display font-bold tracking-tight animate-fade-in"
                  style={{ animationDelay: '200ms' }}
                >
                  Scale your content <span className="text-primary">with confidence</span>
                </h1>
                <p
                  className="text-gray-800 text-lg animate-fade-in pb-3"
                  style={{ animationDelay: '300ms' }}
                >
                  Whether you're a startup or an enterprise, Vivreal offers flexible pricing that grows with your needs.
                  Plans are based on <strong>groups</strong>, <strong>entries</strong>, <strong>user seats</strong>, and <strong>integrations</strong>.
                </p>
                <RouterLink to="/pricing">
                  <Button size="lg" className="font-medium">
                    View all pricing tiers
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </RouterLink>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 text-left">
              <RouterLink
                to="/about/pricing/groups"
                className="transition transform hover:scale-[1.02] hover:shadow-md focus:outline-none"
              >
                <div className="border rounded-xl p-6 shadow-sm bg-background min-h-[300px] hover:border-primary transition-colors flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Groups</h3>
                    <p className="text-gray-800 mb-4">
                      Subscriptions are per group. If you manage multiple groups (clients, brands, or environments), each one requires its own plan.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>✓ Isolated content environments</li>
                    <li>✓ Ideal for multi-tenant setups</li>
                    <li>✓ Flexible billing per group</li>
                  </ul>
                </div>
              </RouterLink>
              <RouterLink
                to="/about/pricing/vivrecords"
                className="transition transform hover:scale-[1.02] hover:shadow-md focus:outline-none"
              >
                <div className="border rounded-xl p-6 shadow-sm bg-background min-h-[300px] hover:border-primary transition-colors flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">VivRecords</h3>
                    <p className="text-gray-800 mb-4">
                      VivRecords are the building blocks of your content. Each plan offers a different limit to fit your publishing needs.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>✓ Free plan includes up to 10 entries</li>
                    <li>✓ Scale to 1,500 entries on higher tiers</li>
                  </ul>
                </div>
              </RouterLink>
              <RouterLink
                to="/about/pricing/userseats"
                className="transition transform hover:scale-[1.02] hover:shadow-md focus:outline-none"
              >
                <div className="border rounded-xl p-6 shadow-sm bg-background min-h-[300px] hover:border-primary transition-colors flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">User Seats</h3>
                    <p className="text-gray-800 mb-4">
                      Add developers, editors, and collaborators with flexible seat-based pricing per plan.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>✓ 1 seat on Free plan</li>
                    <li>✓ Role-based access for teams on Pro & Enterprise</li>
                  </ul>
                </div>
              </RouterLink>
              <RouterLink
                to="/about/pricing/integrations"
                className="transition transform hover:scale-[1.02] hover:shadow-md focus:outline-none"
              >
                <div className="border rounded-xl p-6 shadow-sm bg-background min-h-[300px] hover:border-primary transition-colors flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Integrations</h3>
                    <p className="text-gray-800 mb-4">
                      Publish content and manage products across platforms like social media, e-commerce, and website builders all from Vivreal.
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>✓ Post to Facebook, LinkedIn, X</li>
                    <li>✓ Manage products with Stripe, SquareSpace</li>
                    <li>✓ API and webhook support</li>
                  </ul>
                </div>
              </RouterLink>
            </div>

            <div className="pt-10">
              <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                  View all pricing tiers
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </RouterLink>
              <p className="text-sm text-gray-800 mt-2">
                Compare plans and find the best fit for your team.
              </p>
            </div>
          </div>
        </div>
        <div className="absolute -z-10 -top-16 -left-16 h-64 w-64 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -z-10 -bottom-16 -right-16 h-40 w-40 bg-primary/5 rounded-full blur-2xl"></div>
      </section>
    </>
  );
};

export default PricingAndFeaturesPage;