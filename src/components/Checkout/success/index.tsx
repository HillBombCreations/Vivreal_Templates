"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";

export default function CheckoutSuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  const router = useRouter();
  const siteData = useSiteData();

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/checkout/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            businessName: siteData?.businessInfo?.name,
            contactEmail: siteData?.businessInfo?.contactInfo?.email
          }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed");
      } catch {
      }
    })();
  }, [sessionId]);

  const surface = siteData?.siteDetails?.surface;
  const primary = siteData?.siteDetails?.primary;
  const textPrimary = siteData?.siteDetails?.["text-primary"];
  const businessName = siteData?.businessInfo?.name;
  const textMuted =
    siteData?.siteDetails?.["text-secondary"] ?? "rgba(0,0,0,0.60)";

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
            style={{
              background: `linear-gradient(90deg, ${primary}, rgba(0,0,0,0))`,
            }}
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
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h1
              className="mt-5 text-2xl md:text-3xl font-semibold tracking-tight"
              style={{ color: textPrimary }}
            >
              Thank you!
            </h1>

            <p
              className="mt-2 text-sm md:text-base leading-relaxed"
              style={{ color: textMuted }}
            >
              We appreciate your choice to shop with <span className="font-semibold" style={{ color: textPrimary }}>{businessName}</span>.
            </p>

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                onClick={() => router.push("/products")}
                className="h-11 w-full cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
                style={{ background: primary, color: "white" }}
              >
                Shop some more
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="h-11 w-full rounded-xl cursor-pointer border bg-white/70 text-sm font-semibold shadow-sm transition active:scale-[0.99]"
                style={{ borderColor: "rgba(0,0,0,0.10)", color: textPrimary }}
              >
                Back to home
              </button>
            </div>

            <div className="mt-5 text-[11px]" style={{ color: "rgba(0,0,0,0.50)" }}>
              Your order is being processed — keep an eye on your email for confirmation.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}