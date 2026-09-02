"use client";

import { useState } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface SubscribeClientProps {
  collectionId: string;
  labels: Record<string, string>;
  /**
   * NEW-A — the page-h1 election's verdict (renderer pageH1.ts, 1.52.0):
   * 'h2' when another section owns the page h1, 'h1' when this one does.
   * Absent ⇒ 'h1' (the pre-election default).
   */
  pageHeadingLevel?: "h1" | "h2";
}

export default function SubscribeClient({
  collectionId,
  labels,
  pageHeadingLevel,
}: SubscribeClientProps) {
  const siteData = useSiteData();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const title = labels?.title || "Stay in the loop";
  const subtitle =
    labels?.subtitle ||
    "Subscribe to get the latest updates, news, and exclusive content delivered straight to your inbox.";
  // NEW-A — the election owns the page-h1 decision; absent ⇒ 'h1'.
  const HeadingTag = pageHeadingLevel ?? ("h1" as const);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, email: email.trim() }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        const data = await res.json().catch(() => null);
        setStatus("error");
        setErrorMessage(
          data?.error || "Something went wrong. Please try again."
        );
      }
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="mx-auto max-w-xl w-full px-6">
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
            style={{ background: `${siteData?.primary || "#1a1a2e"}15` }}
          >
            <Mail
              className="h-8 w-8"
              style={{ color: siteData?.primary || "#1a1a2e" }}
            />
          </div>
          <HeadingTag
            className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            style={{ color: siteData?.["text-primary"] }}
          >
            {title}
          </HeadingTag>
          <p
            className="text-base md:text-lg max-w-md mx-auto leading-relaxed"
            style={{ color: siteData?.["text-secondary"] || "rgba(0,0,0,0.6)" }}
          >
            {subtitle}
          </p>
        </div>

        {status === "success" ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: siteData?.surface || "#f8f9fa" }}
          >
            <CheckCircle
              className="h-12 w-12 mx-auto mb-4"
              style={{ color: siteData?.primary || "#1a1a2e" }}
            />
            {/* NOT "you are subscribed". Capture writes
                `subscriberStatus: 'pending'` and the campaign send path
                allow-lists `'subscribed'`, so this person cannot receive
                anything until they click the link in the confirmation email.
                Saying they are subscribed is false at the moment they read it,
                and it removes their reason to go and finish -- the list then
                fills with addresses that can never be mailed, and the owner
                sees signups that never convert. */}
            <h2 className="text-xl font-semibold mb-2">Almost there</h2>
            <p
              className="text-sm"
              style={{
                color: siteData?.["text-secondary"] || "rgba(0,0,0,0.6)",
              }}
            >
              {labels?.successMessage ||
                "We sent you an email. Click the link in it to confirm, and you are all set."}
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-6 text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              style={{ color: siteData?.primary || "#1a1a2e" }}
            >
              Subscribe another email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                placeholder={labels?.placeholder || "Enter your email"}
                className="flex-1 h-12 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 transition"
                style={{
                  borderColor:
                    status === "error"
                      ? "#ef4444"
                      : siteData?.border || "rgba(0,0,0,0.1)",
                  background: siteData?.surface || "#ffffff",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ["--tw-ring-color" as any]: siteData?.primary || "#1a1a2e",
                }}
                disabled={status === "loading"}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-12 px-8 rounded-xl text-sm font-semibold transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
                style={{
                  background: siteData?.primary || "#1a1a2e",
                  color: siteData?.["text-inverse"] || "#ffffff",
                }}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  labels?.buttonLabel || "Subscribe"
                )}
              </button>
            </div>

            {status === "error" && errorMessage && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            <p
              className="text-xs text-center"
              style={{
                color: siteData?.["text-secondary"] || "rgba(0,0,0,0.4)",
              }}
            >
              {/* This one is TRUE, and only recently. It rests on a chain that
                  has to stay intact: the campaign compiler emits an
                  `{{unsubscribeUrl}}` placeholder into a footer nobody can
                  delete, VR_Secure_API's `dispatchCampaign` REFUSES to queue
                  any campaign whose HTML lacks that placeholder, and
                  VR_Main_API's send worker substitutes a real per-recipient
                  URL for it. Break any link and this sentence becomes a lie
                  on every customer site at once. */}
              {labels?.disclaimer ||
                "We respect your privacy. Unsubscribe at any time."}
            </p>
          </form>
        )}
      </section>
    </main>
  );
}
