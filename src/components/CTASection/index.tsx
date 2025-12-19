"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";

const CTASection = () => {
  const siteData = useSiteData();

  const primary = siteData?.siteDetails?.primary;
  const surfaceAlt = siteData?.siteDetails?.["surface-alt"];
  const textInverse = siteData?.siteDetails?.["text-inverse"];

  return (
    <section className="py-12 md:py-20">
      <div className="content-grid">
        <div
          className="rounded-3xl"
          style={{ background: primary }}
        >
          <div className="px-6 py-12 md:px-16 md:py-16 text-center">
            <div className="mx-auto max-w-3xl">
              <h2
                className="text-3xl md:text-4xl font-semibold tracking-tight"
                style={{ color: textInverse }}
              >
                Shop our full collection
              </h2>

              <p
                className="mt-4 text-sm md:text-lg leading-relaxed opacity-90"
                style={{ color: textInverse }}
              >
                Discover our complete lineup of handcrafted products, made with
                care and meant to be enjoyed. From everyday favorites to special
                treats, it’s all here.
              </p>

              <div className="mt-8 flex justify-center">
                <Link href="/products">
                  <Button
                    size="lg"
                    className="h-12 px-6 cursor-pointer text-sm font-semibold inline-flex items-center gap-2 shadow-md transition active:scale-[0.97]"
                    style={{
                      background: surfaceAlt || "#ffffff",
                      color: primary,
                    }}
                  >
                    Browse products
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;