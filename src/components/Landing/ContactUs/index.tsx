"use client";

import { useMemo, useState } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";

type ContactSectionContent = {
  title: string;
  subtitle: string;
  buttonLabel: string;
};

type BusinessInfo = {
  name: string;
  contactInfo: { email: string };
};

type ContactSectionProps = {
  contactSection: ContactSectionContent;
};

type ToastState =
  | { open: false }
  | { open: true; type: "success" | "error"; message: string };

export default function ContactSection({ contactSection }: ContactSectionProps) {
  const siteData = useSiteData();
  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surfaceAlt = siteData?.siteDetails?.["surface-alt"] ?? "var(--surface-alt,#f7f8fb)";

  const [form, setForm] = useState({ fullName: "", email: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false });

  const disabled = useMemo(() => {
    return !form.fullName || !form.email || !form.message || loading;
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
          email: form.email,
          message: form.message,
          siteName: siteData?.businessInfo?.name || '',
          to: siteData?.businessInfo?.contactInfo.email,
        }),
      });

      if (!res.ok) {
        showToast({ open: true, type: "error", message: "Error sending message. Please try again." });
        return;
      }

      setForm({ fullName: "", email: "", message: "" });
      showToast({
        open: true,
        type: "success",
        message: `Successfully contacted ${siteData?.businessInfo?.name}! We will get back to you soon.`,
      });
    } catch {
      showToast({ open: true, type: "error", message: "Network error. Please try again later." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section style={{ background: surfaceAlt }} className="relative overflow-hidden py-14 md:py-20">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl opacity-15"
        style={{ background: `radial-gradient(circle at center, ${primary} 0%, transparent 70%)` }}
      />

      <div className="mx-5 md:mx-20 lg:mx-40">
        {toast.open ? (
          <div className="fixed left-1/2 top-4 z-50 w-[92vw] max-w-md -translate-x-1/2">
            <div
              className="rounded-2xl border px-4 py-3 shadow-sm backdrop-blur"
              style={{
                background: "rgba(255,255,255,0.9)",
                borderColor: "rgba(0,0,0,0.10)",
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-1 inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: toast.type === "success" ? "#16a34a" : "#ef4444" }}
                />
                <p className="text-[13px] leading-snug text-black/80">{toast.message}</p>
                <button
                  type="button"
                  onClick={() => setToast({ open: false })}
                  className="ml-auto rounded-lg px-2 py-1 text-[12px] font-semibold text-black/60 hover:text-black"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">{contactSection.title}</h2>
            <p className="mt-3 text-sm md:text-base leading-relaxed text-black/60 max-w-lg mx-auto lg:mx-0">
              {contactSection.subtitle}
            </p>
          </div>

          <div className="lg:col-span-7">
            <div
              className="rounded-3xl border bg-white/70 p-5 md:p-7 shadow-sm backdrop-blur"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <div className="grid gap-3">
                <LabelInput
                  label="Full name"
                  value={form.fullName}
                  onChange={onChange("fullName")}
                  placeholder="Justin Ceccarelli"
                />

                <LabelInput
                  label="Email"
                  value={form.email}
                  onChange={onChange("email")}
                  placeholder="you@domain.com"
                  type="email"
                />

                <LabelTextarea
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
                  className="mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: primary, color: "white" }}
                >
                  {loading ? <Spinner /> : contactSection.buttonLabel}
                </button>

                <p className="text-[11px] text-black/50 leading-relaxed">
                  By submitting, you agree we may contact you back at the email provided.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LabelInput(props: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-black/70">{props.label}</span>
      <input
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        type={props.type ?? "text"}
        className="h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none transition focus:ring-2"
        style={{ borderColor: "rgba(0,0,0,0.10)" }}
      />
    </label>
  );
}

function LabelTextarea(props: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12px] font-semibold text-black/70">{props.label}</span>
      <textarea
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
        rows={props.rows ?? 4}
        className="w-full rounded-xl border bg-white px-3 py-3 text-sm outline-none transition focus:ring-2"
        style={{ borderColor: "rgba(0,0,0,0.10)" }}
      />
    </label>
  );
}

function Spinner() {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      <span className="text-sm">Sending…</span>
    </span>
  );
}