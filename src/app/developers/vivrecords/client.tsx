"use client";

import React from "react";
import { Button } from "@/components/Button";
import { ArrowRight } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import Link from "next/link";
import Navbar from "@/components/Navigation/Navbar";
import Head from "next/head";
import { hexToRgba } from "@/lib/utils";

const VivrecordsPage = () => {
    const siteData = useSiteData();
    
  return (
    <>
        <Head>
            <title>Vivreal Headless CMS | What are VivRecords?</title>
            <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
            <link rel="canonical" href={'https://www.vivreal.io/developers/vivrecords'} />
        </Head>
        <Navbar />
        <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid max-w-4xl mx-auto">
            <div className="space-y-6 text-center">
            <span style={{ background: hexToRgba(siteData?.primary ?? "", 0.8), color: siteData?.["text-inverse"] }} className="inline-block text-sm font-medium px-3 py-1 rounded-full">
                Understanding Your Content Units
            </span>

            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                What Are <span style={{ color: siteData?.primary }}>Vivrecords</span>?
            </h1>

            <p style={{ color: siteData?.["text-primary"] }} className="text-gray-800 text-lg max-w-2xl mx-auto">
                Vivrecords represent the core content pieces you create and manage within Vivreal. These include collection objects and integration objects that hold your valuable data and power your digital experiences.
            </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-16">
            {/* Definition & Scope */}
            <div style={{ background: siteData?.surface }} className="border rounded-xl p-6 shadow-sm">
                <h3 className="text-xl font-semibold mb-2">Defining Vivrecords</h3>
                <p style={{ color: siteData?.["text-primary"] }} className="mb-4">
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
                <p style={{ color: siteData?.["text-primary"] }} className="mb-4">
                Unlike many platforms, Vivreal&apos;s pricing model is based solely on the number of Vivrecords not media or data storage. You can upload and manage your media files freely without worrying about storage limits affecting your plan.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Media storage is unlimited and separate from Vivrecord counts</li>
                <li>✓ Focus on building your content, not managing storage quotas</li>
                <li>✓ Vivrecord limits per tier: <strong>10, 50, 500, 1500</strong></li>
                </ul>
            </div>
            </div>

            <div className="text-center mt-16">
            <Link href="/pricing">
                <Button size="lg" style={{ background: siteData?.primary, color: siteData?.["text-inverse"] }} className="font-medium cursor-pointer">
                Explore pricing
                <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
            <p style={{ color: siteData?.["text-primary"] }} className="text-sm mt-2">
                Choose the plan that fits your content needs best.
            </p>
            </div>
        </div>

        {/* Decorative background */}
        <div style={{ background: hexToRgba(siteData?.primary ?? "", 0.1) }} className="absolute -z-10 -top-16 -left-16 h-64 w-64 rounded-full blur-3xl"></div>
        <div style={{ background: hexToRgba(siteData?.primary ?? "", 0.05) }} className="absolute -z-10 -bottom-16 -right-16 h-40 w-40 rounded-full blur-2xl"></div>
        </section>
    </>
  );
};

export default VivrecordsPage;