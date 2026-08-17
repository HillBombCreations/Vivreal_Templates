"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail, Clock, Users, X, CheckCircle2, AlertCircle } from "lucide-react";
import type { ContentLayoutProps } from "@/types/ContentItem";
import { resolveContactErrorMessage, shouldResetContactFormOnSubmit } from "@/lib/contactErrorMessage";

interface ToastState {
  open: boolean;
  type?: "success" | "error";
  message?: string;
}

// Task 14 item 9 (dashboard-insights-phase-3-capture/plan.md) — the built-in
// fallbacks, unchanged strings, now routed through resolveContactErrorMessage
// so a specific server string (Task 8's copy-batch.md rows 3/4/6) wins when
// present.
const CONTACT_ERROR_FALLBACK = "Error sending message. Please try again.";
const CONTACT_NETWORK_ERROR = "Network error. Please try again later.";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-8 animate-pulse max-w-2xl mx-auto">
      <div className="h-7 w-1/2 rounded-lg bg-black/[0.06] mb-3" />
      <div className="h-4 w-3/4 rounded-lg bg-black/[0.04] mb-8" />
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-11 rounded-xl bg-black/[0.04]" />
          <div className="h-11 rounded-xl bg-black/[0.04]" />
        </div>
        <div className="h-32 rounded-xl bg-black/[0.04]" />
        <div className="h-12 rounded-full bg-black/[0.06]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form Layout                                                        */
/* ------------------------------------------------------------------ */

export default function FormLayout({
  items,
  accent,
  loading,
}: ContentLayoutProps) {
  const primary = accent || "var(--primary)";

  const [form, setForm] = useState({ fullName: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false });

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const disabled = useMemo(() => {
    return !form.fullName || !form.email || !isValidEmail(form.email) || !form.message || submitting;
  }, [form, submitting]);

  // Task 14 item 9 (ux-critique F3) — error toasts persist until dismissed
  // or the next submit resolves; success toasts keep today's auto-dismiss.
  const showToast = (next: ToastState, opts?: { persist?: boolean }) => {
    setToast(next);
    if (!opts?.persist) {
      window.setTimeout(() => setToast({ open: false }), 4500);
    }
  };

  // Task 14 item 10 (R1 — widened to all three fleet contact components):
  // focus the error toast/box when it appears. role="alert" on the box
  // below announces it too; this moves focus so a keyboard/screen-reader
  // visitor actually lands on it.
  const toastBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (toast.open && toast.type === "error") {
      toastBoxRef.current?.focus();
    }
  }, [toast]);

  const onChange =
    (key: "fullName" | "email" | "message") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const onSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.fullName,
          customerEmail: form.email,
          message: form.message,
        }),
      });

      if (!shouldResetContactFormOnSubmit(res.ok)) {
        // Task 14 item 9 — parse the body defensively; a non-JSON or empty
        // body must never throw here. Typed input is intentionally NOT
        // reset on this path (ux-critique F3).
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        showToast(
          { open: true, type: "error", message: resolveContactErrorMessage(body?.error, CONTACT_ERROR_FALLBACK) },
          { persist: true },
        );
        return;
      }

      setForm({ fullName: "", email: "", message: "" });
      showToast({ open: true, type: "success", message: "Message sent! We'll get back to you soon." });
    } catch {
      showToast({ open: true, type: "error", message: CONTACT_NETWORK_ERROR }, { persist: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Skeleton />;

  const features = [
    { icon: <Mail className="h-4 w-4" />, label: "Direct support" },
    { icon: <Clock className="h-4 w-4" />, label: "Fast replies" },
    { icon: <Users className="h-4 w-4" />, label: "Real humans" },
  ];

  return (
    <>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] items-center min-h-[50vh]">
        {/* Left column -- feature badges */}
        <div className="flex flex-col gap-4">
          {features.map((f) => (
            <div
              key={f.label}
              className="inline-flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-5 py-3.5 text-sm font-medium text-black/70 shadow-sm"
            >
              <span
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${primary} 10%, transparent)`, color: primary }}
              >
                {f.icon}
              </span>
              {f.label}
            </div>
          ))}
        </div>

        {/* Right column -- form */}
        <div className="w-full">
          <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 md:p-8">
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-black/60">Full name</span>
                  <input
                    value={form.fullName}
                    onChange={onChange("fullName")}
                    placeholder="Your name"
                    className="h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-black/60">Email</span>
                  <input
                    value={form.email}
                    onChange={onChange("email")}
                    placeholder="you@example.com"
                    type="email"
                    className={`h-11 w-full rounded-xl border bg-black/[0.015] px-4 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30 ${
                      form.email.length > 0 && !isValidEmail(form.email)
                        ? "border-red-400"
                        : "border-black/[0.08]"
                    }`}
                  />
                  {form.email.length > 0 && !isValidEmail(form.email) && (
                    <span className="text-[11px] text-red-500">Please enter a valid email</span>
                  )}
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-black/60">Message</span>
                <textarea
                  value={form.message}
                  onChange={onChange("message")}
                  placeholder="How can we help?"
                  rows={5}
                  className="w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30 resize-none"
                />
              </label>

              <button
                type="button"
                onClick={onSubmit}
                disabled={disabled}
                className="h-12 w-full cursor-pointer rounded-full text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: primary, color: "white" }}
              >
                {submitting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Sending...
                  </span>
                ) : (
                  "Send message"
                )}
              </button>

              <p className="text-[11px] text-black/40 text-center leading-relaxed">
                By submitting, you agree we may contact you at the email provided.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast.open && (
        <div className="fixed left-1/2 top-5 z-50 w-[92vw] max-w-md -translate-x-1/2 animate-fade-in">
          <div
            ref={toastBoxRef}
            role={toast.type === "error" ? "alert" : undefined}
            tabIndex={toast.type === "error" ? -1 : undefined}
            className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-lg outline-none"
          >
            <div className="flex items-center gap-3">
              {toast.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
              )}
              <p className="flex-1 text-sm text-black/80">{toast.message}</p>
              <button
                type="button"
                onClick={() => setToast({ open: false })}
                className="cursor-pointer rounded-lg p-1 hover:bg-black/5 transition"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-black/40" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
