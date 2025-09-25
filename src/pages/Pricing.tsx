import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PricingToggle from '@/components/PricingToggle';
import PricingCard from '@/components/PricingCard';
import { Separator } from '@/components/ui/separator';
import { pricingData } from '@/data/pricing';
import CTASection from '@/components/CTASection';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const plans = pricingData[billingCycle];

  return (
    <>
      <Helmet>
        <title>Vivreal Pricing | Flexible Headless CMS Plans & Costs</title>
        <meta name="description" content="Explore Vivreal's transparent pricing for headless CMS solutions. Compare plans, features, and costs to find the perfect fit for your business needs." />
        <link rel="canonical" href={'https://www.vivreal.io/pricing'} />
      </Helmet>
      
      <Navbar />
      
      <main className="pt-24 pb-20">
        <section className="pt-10 pb-16">
          <div className="content-grid">
            <div className="text-center max-w-3xl mx-auto mb-12 animate-fade-in">
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
                Simple, Transparent Pricing
              </h1>
              <p className="text-lg text-gray-800">
                Choose the perfect plan for your needs. No hidden fees or surprises.
              </p>
            </div>
            
            <PricingToggle 
              value={billingCycle} 
              onChange={setBillingCycle} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {plans.map((plan, index) => (
                <PricingCard 
                  key={plan.key} 
                  plan={plan}
                  isAnnual={billingCycle === 'annual'} 
                />
              ))}
            </div>
            
            <div className="mt-16 text-center">
              <div className="max-w-3xl mx-auto">
                <h3 className="text-xl font-semibold mb-2">All plans include:</h3>
                <p className="text-gray-800 mb-8">
                  Advanced security, reliable performance, and expert support when you need it.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="font-medium mb-1">High Performance</div>
                    <p className="text-gray-800">Lightning-fast content delivery</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="font-medium mb-1">Flexible API</div>
                    <p className="text-gray-800">Connect to any frontend framework</p>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="font-medium mb-1">Scheduled Publishing</div>
                    <p className="text-gray-800">Automate your content releases</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <Separator />
        
        <section className="py-16">
          <div className="content-grid">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center">
                Frequently Asked Questions
              </h2>
              
              <div className="space-y-6 mt-8">
                <div>
                  <h3 className="text-lg font-semibold mb-2">What is a "VivRecord"?</h3>
                  <p className="text-gray-800">
                    A VivRecord is a content entry in your Vivreal CMS. It can be a blog post, product, page, or any other content type you define in your schema.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Can I upgrade or downgrade my plan at any time?</h3>
                  <p className="text-gray-800">
                    Yes! You can change your plan at any time. If you upgrade, you'll be charged a prorated amount for the remainder of your billing cycle. If you downgrade, your new rate will take effect at the next billing cycle.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">What payment methods do you accept?</h3>
                  <p className="text-gray-800">
                    We accept all major credit cards, including Visa, Mastercard, American Express, and Discover. For Enterprise plans, we also offer invoicing.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">Do you offer a free trial?</h3>
                  <p className="text-gray-800">
                    Our Free plan is available forever with no credit card required. It's the perfect way to test out Vivreal and see if it meets your needs before upgrading.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-2">What kind of support can I expect?</h3>
                  <p className="text-gray-800">
                    All plans include email support. Higher-tier plans include priority support with faster response times, and our Enterprise plan includes dedicated support with a named account manager.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <CTASection page="Pricing"/>
      </main>
      
      <Footer />
    </>
  );
};

export default Pricing;
