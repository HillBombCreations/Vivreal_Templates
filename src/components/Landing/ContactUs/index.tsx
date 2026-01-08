"use client";

import { useMemo, useState } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { ContactSectionProps, ToastState } from "@/types/Landing";

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
          customerEmail: form.email,
          message: form.message,
          siteName: siteData?.businessInfo?.name || '',
          contactEmail: siteData?.businessInfo?.contactInfo?.email
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
    <section
      style={{ background: surfaceAlt }}
      className="relative overflow-hidden min-h-[100svh] flex items-stretch py-10 md:py-16"
    >
      <div className="mx-5 md:mx-20 lg:mx-40 w-full flex items-center">
        <div className="w-full grid gap-10 lg:grid-cols-12 items-center min-h-[calc(100svh-5rem)] md:min-h-[calc(100svh-8rem)]">
          <div className="lg:col-span-5 text-center lg:text-left">
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
              {contactSection?.title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold border bg-white/70 backdrop-blur"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                Friendly Service
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold border bg-white/70 backdrop-blur"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                Fast replies
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold border bg-white/70 backdrop-blur"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                Real humans
              </span>
            </div>
            <p className="mt-4 text-sm md:text-base leading-relaxed text-black/60 max-w-lg mx-auto lg:mx-0">
              {contactSection?.subtitle}
            </p>

            <p className="mt-4 text-[12px] text-black/50">
              Need a dozen, a platter, or something special? Let’s make it happen.
            </p>
          </div>

          <div className="lg:col-span-7 w-full">
            <div
              className="relative rounded-3xl border shadow-sm overflow-hidden bg-white/70 backdrop-blur"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <div className="p-5 md:p-7">
                <div className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabelInput
                      label="Full name"
                      value={form.fullName}
                      onChange={onChange("fullName")}
                      placeholder="Your Name"
                    />

                    <LabelInput
                      label="Email"
                      value={form.email}
                      onChange={onChange("email")}
                      placeholder="you@domain.com"
                      type="email"
                    />
                  </div>

                  <LabelTextarea
                    label="Message"
                    value={form.message}
                    onChange={onChange("message")}
                    placeholder="Quick context + what you’re trying to do…"
                    rows={6}
                  />

                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={disabled}
                    className={`
                      mt-1 h-12 w-full cursor-pointer rounded-2xl text-sm font-semibold
                      shadow-sm transition active:scale-[0.99]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      focus:outline-none focus:ring-2 focus:ring-black/10
                    `}
                    style={{ background: primary, color: "white" }}
                  >
                    {loading ? <Spinner /> : contactSection?.buttonLabel}
                  </button>

                  <p className="text-[11px] text-black/50 leading-relaxed">
                    No spam. Just a reply. By submitting, you agree we may contact you back at the email provided.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {toast.open ? (
            <div className="fixed left-1/2 top-4 z-50 w-[92vw] max-w-md -translate-x-1/2">
              <div
                className="rounded-2xl border px-4 py-3 shadow-sm backdrop-blur"
                style={{
                  background: "rgba(255,255,255,0.92)",
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
                    className="ml-auto cursor-pointer rounded-lg px-2 py-1 text-[12px] font-semibold text-black/60 hover:text-black"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
        className={`
          h-12 w-full rounded-2xl border bg-white/80 px-4
          text-base md:text-sm
          outline-none transition
          focus:ring-2 focus:ring-black/10
          focus:border-black/20
          placeholder:text-black/35
        `}
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
        className={`
          w-full rounded-2xl border bg-white/80 px-4 py-3 text-base md:text-sm
          outline-none transition
          focus:ring-2 focus:ring-black/10
          focus:border-black/20
          placeholder:text-black/35
        `}
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