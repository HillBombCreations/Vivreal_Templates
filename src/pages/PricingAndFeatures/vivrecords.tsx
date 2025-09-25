import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Helmet } from 'react-helmet';

const VivrecordsPage = () => {
  return (
    <>
        <Helmet>
            <title>Vivreal Headless CMS | What are VivRecords?</title>
            <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
            <link rel="canonical" href={'https://www.vivreal.io/developers/vivrecords'} />
        </Helmet>
        <Navbar />
        <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid max-w-4xl mx-auto">
            <div className="space-y-6 text-center">
            <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                Understanding Your Content Units
            </span>

            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                What Are <span className="text-primary">Vivrecords</span>?
            </h1>

            <p className="text-gray-800 text-lg max-w-2xl mx-auto">
                Vivrecords represent the core content pieces you create and manage within Vivreal. These include collection objects and integration objects that hold your valuable data and power your digital experiences.
            </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-16">
            {/* Definition & Scope */}
            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Defining Vivrecords</h3>
                <p className="text-gray-800 mb-4">
                Vivrecords are individual content objects, such as items within collections or integration records, that you create to organize and present your data effectively.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Collection objects (e.g., articles, products, profiles)</li>
                <li>✓ Integration objects created via connected services</li>
                <li>✗ Collection groups themselves do <strong>not</strong> count as Vivrecords</li>
                <li>✗ Objects generated from a created site on the Sites page are <strong>also not</strong> counted as Vivrecords</li>
                </ul>
            </div>

            {/* Storage & Pricing */}
            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Storage & Pricing</h3>
                <p className="text-gray-800 mb-4">
                Unlike many platforms, Vivreal's pricing model is based solely on the number of Vivrecords not media or data storage. You can upload and manage your media files freely without worrying about storage limits affecting your plan.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Media storage is unlimited and separate from Vivrecord counts</li>
                <li>✓ Focus on building your content, not managing storage quotas</li>
                <li>✓ Vivrecord limits per tier: <strong>10, 50, 500, 1500</strong></li>
                </ul>
            </div>
            </div>

            <div className="text-center mt-16">
            <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                Explore pricing
                <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </RouterLink>
            <p className="text-sm text-gray-800 mt-2">
                Choose the plan that fits your content needs best.
            </p>
            </div>
        </div>

        {/* Decorative background */}
        <div className="absolute -z-10 -top-16 -left-16 h-64 w-64 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -z-10 -bottom-16 -right-16 h-40 w-40 bg-primary/5 rounded-full blur-2xl"></div>
        </section>
    </>
  );
};

export default VivrecordsPage;