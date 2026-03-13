"use client";

import { useMemo, useState } from "react";
import type { HomeSectionProps } from "../index";
import type { LandingSection, ToastState } from "@/types/Landing";
import { Mail, Clock, Users, X, CheckCircle2, AlertCircle } from "lucide-react";

const ContactSection = ({ siteData, prefetchedData }: HomeSectionProps) => {
  const contactSection = prefetchedData?.contactUs as LandingSection | undefined;

  const primary = siteData?.primary ?? "#1a1a2e";
  const surface = siteData?.surface ?? "#ffffff";

  const [form, setForm] = useState({ fullName: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false });

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const disabled = useMemo(() => {
    return !form.fullName || !form.email || !isValidEmail(form.email) || !form.message || loading;
  }, [form, loading]);

  const showToast = (next: Exclude<ToastState, { open: false }>, ms = 4500) => {
    setToast(next);
    window.setTimeout(() => setToast({ open: false }), ms);
  };

  const onChange =
    (key: "fullName" | "email" | "message") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const onSubmit = async () => {
    try {
      setLoading(true);

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.fullName,
          customerEmail: form.email,
          message: form.message,
          siteName: siteData?.businessInfo?.name || siteData?.name || "",
          contactEmail: siteData?.businessInfo?.contactInfo?.email || "",
          branding: {
            primary: siteData?.primary,
            surface: siteData?.["surface-alt"],
            textPrimary: siteData?.["text-primary"],
            logoUrl: siteData?.logo?.currentFile?.source,
          },
        }),
      });

      if (!res.ok) {
        showToast({
          open: true,
          type: "error",
          message: "Error sending message. Please try again.",
        });
        return;
      }

      setForm({ fullName: "", email: "", message: "" });
      showToast({
        open: true,
        type: "success",
        message: "Message sent! We'll get back to you soon.",
      });
    } catch {
      showToast({
        open: true,
        type: "error",
        message: "Network error. Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: <Mail className="h-4 w-4" />, label: "Direct support" },
    { icon: <Clock className="h-4 w-4" />, label: "Fast replies" },
    { icon: <Users className="h-4 w-4" />, label: "Real humans" },
  ];

  return (
    <section
      style={{ background: surface }}
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          {/* Left column — heading */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              {contactSection?.title || "Get in touch"}
            </h2>

            <p className="mt-4 text-base md:text-lg leading-relaxed text-black/55 max-w-lg mx-auto lg:mx-0">
              {contactSection?.subtitle ||
                "Have a question or special request? Drop us a line."}
            </p>

            {/* Feature badges */}
            <div className="mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
              {features.map((f) => (
                <div
                  key={f.label}
                  className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.02] px-4 py-2 text-xs font-medium text-black/70"
                >
                  <span style={{ color: primary }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          {/* Right column — form */}
          <div className="w-full">
            <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 md:p-8">
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormInput
                    label="Full name"
                    value={form.fullName}
                    onChange={onChange("fullName")}
                    placeholder="Your name"
                  />
                  <FormInput
                    label="Email"
                    value={form.email}
                    onChange={onChange("email")}
                    placeholder="you@example.com"
                    type="email"
                    error={form.email.length > 0 && !isValidEmail(form.email) ? "Please enter a valid email" : undefined}
                  />
                </div>

                <FormTextarea
                  label="Message"
                  value={form.message}
                  onChange={onChange("message")}
                  placeholder="How can we help?"
                  rows={5}
                />

                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={disabled}
                  className="h-12 w-full cursor-pointer rounded-full text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: primary, color: "white" }}
                >
                  {loading ? <Spinner /> : (contactSection?.buttonLabel as string) || "Send message"}
                </button>

                <p className="text-[11px] text-black/40 text-center leading-relaxed">
                  By submitting, you agree we may contact you at the email
                  provided.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast.open && (
        <div className="fixed left-1/2 top-5 z-50 w-[92vw] max-w-md -translate-x-1/2 animate-fade-in">
          <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-lg">
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
    </section>
  );
};

function FormInput(props: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-black/60">{props.label}</span>
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        type={props.type ?? "text"}
        className={`h-11 w-full rounded-xl border bg-black/[0.015] px-4 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30 ${props.error ? "border-red-400 focus:border-red-400" : "border-black/[0.08] focus:border-black/[0.15]"}`}
      />
      {props.error && (
        <span className="text-[11px] text-red-500">{props.error}</span>
      )}
    </label>
  );
}

function FormTextarea(props: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-black/60">{props.label}</span>
      <textarea
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        rows={props.rows ?? 4}
        className="w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] focus:border-black/[0.15] placeholder:text-black/30 resize-none"
      />
    </label>
  );
}

function Spinner() {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      <span className="text-sm">Sending...</span>
    </span>
  );
}

export default ContactSection;
