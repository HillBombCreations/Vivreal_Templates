import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Helmet } from 'react-helmet';

const IntegrationsPage = () => {
  return (
    <>
        <Helmet>
            <title>Vivreal Headless CMS | What are Integrations?</title>
            <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
            <link rel="canonical" href={'https://www.vivreal.io/developers/integrations'} />
        </Helmet>
        <Navbar />
        <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid max-w-4xl mx-auto">
            <div className="space-y-6 text-center">
            <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                Connect and automate
            </span>

            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                What are <span className="text-primary">Integrations</span>?
            </h1>

            <p className="text-gray-800 text-lg max-w-2xl mx-auto">
                Integrations allow you to connect Vivreal with external platforms whether it's social media, e-commerce, payment processors, or website builders to streamline content management and product updates across your tools.
            </p>

            <div className="text-center mt-16">
                <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                    View pricing
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                </RouterLink>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-16">
            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Integration Limits</h3>
                <p className="text-gray-800 mb-4">
                Each subscription tier limits how many integrations your group can have active simultaneously. Integrations allow automated workflows and content synchronization across platforms.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Basic tiers support up to 3 integrations</li>
                <li>✓ Mid-tier plans increase limits to 5 integrations</li>
                <li>✓ Higher tiers offer unlimited integrations for full flexibility</li>
                </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Counting Integrations & Entries</h3>
                <p className="text-gray-800 mb-4">
                Each active integration counts as one integration toward your plan limit. Additionally, every integration creates integration objects that count as <strong>Vivrecords</strong> (entries) within your group.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Track integrations easily through your dashboard</li>
                <li>✓ Integration objects contribute to your entry limits</li>
                <li>✓ Manage both integration and entry limits together</li>
                </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Expanding Our Integrations</h3>
                <p className="text-gray-800 mb-4">
                We're actively expanding the number and variety of integrations available on Vivreal. Our goal is to help you connect to the platforms you use most.
                </p>
                <p className="text-gray-800 mb-4">
                We welcome feedback from the community about which integrations you'd like to see next. Your input helps us prioritize and deliver the most impactful connections.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ New integrations regularly added</li>
                <li>✓ Community-driven roadmap</li>
                <li>✓ Flexible and scalable connection options</li>
                </ul>
            </div>
            </div>

            <div className="text-center mt-16">
            <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                View pricing
                <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </RouterLink>
            </div>
        </div>

        <div className="absolute -z-10 -top-16 -left-16 h-64 w-64 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -z-10 -bottom-16 -right-16 h-40 w-40 bg-primary/5 rounded-full blur-2xl"></div>
        </section>
    </>
  );
};

export default IntegrationsPage;