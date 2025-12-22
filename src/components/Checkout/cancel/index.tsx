"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";

export default function CheckoutCancelledClient() {
  const router = useRouter();
  const siteData = useSiteData();
  const { setOpenCartMenu } = useCartContext();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surface = siteData?.siteDetails?.surface ?? "var(--surface,#ffffff)";
  const textPrimary = siteData?.siteDetails?.["text-primary"] ?? "#0b1220";
  const textMuted = siteData?.siteDetails?.["text-secondary"] ?? "rgba(0,0,0,0.60)";

  useEffect(() => {
    setOpenCartMenu?.(false);
  }, [setOpenCartMenu]);

  return (
    <main
      className="min-h-[100dvh] flex items-center justify-center px-4 py-10"
      style={{ background: surface }}
    >
      <div className="w-full max-w-xl">
        <div
          className="rounded-3xl border bg-white/70 backdrop-blur shadow-sm overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div
            className="h-1.5 w-full"
            style={{ background: `linear-gradient(90deg, ${primary}, rgba(0,0,0,0))` }}
          />

          <div className="p-6 md:p-8 text-center">
            <div
              className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border"
              style={{
                borderColor: "rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.7)",
                color: primary,
              }}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h1
              className="mt-5 text-2xl md:text-3xl font-semibold tracking-tight"
              style={{ color: textPrimary }}
            >
              Checkout canceled
            </h1>

            <p className="mt-2 text-sm md:text-base leading-relaxed" style={{ color: textMuted }}>
              Your checkout process was canceled. No worries — you can jump back into shopping anytime.
            </p>

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="h-11 w-full cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
                style={{ background: primary, color: "white" }}
              >
                Continue shopping
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setOpenCartMenu?.(true)}
                className="h-11 w-full cursor-pointer rounded-xl border bg-white/70 text-sm font-semibold shadow-sm transition active:scale-[0.99]"
                style={{ borderColor: "rgba(0,0,0,0.10)", color: textPrimary }}
              >
                View bag
              </button>
            </div>

            <div className="mt-5 text-[11px]" style={{ color: "rgba(0,0,0,0.50)" }}>
              If you keep getting redirected here, double-check your payment details or try again in a moment.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}