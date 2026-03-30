import { useMemo, useState } from "react";
import type { HomeSectionProps } from "../types/SiteData";
import type { LandingSection } from "../types/Landing";
import { Mail, Clock, Users } from "lucide-react";

const ContactSection = ({ siteData, prefetchedData }: HomeSectionProps) => {
  const contactSection = prefetchedData?.contactUs as LandingSection | undefined;
  const primary = siteData?.primary ?? "#1a1a2e";
  const surface = siteData?.surface ?? "#ffffff";

  const [form, setForm] = useState({ fullName: "", email: "", message: "" });
  const [loading] = useState(false);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const disabled = useMemo(() => {
    return !form.fullName || !form.email || !isValidEmail(form.email) || !form.message || loading;
  }, [form, loading]);

  const onChange = (key: "fullName" | "email" | "message") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const features = [
    { icon: <Mail className="h-4 w-4" />, label: "Direct support" },
    { icon: <Clock className="h-4 w-4" />, label: "Fast replies" },
    { icon: <Users className="h-4 w-4" />, label: "Real humans" },
  ];

  return (
    <section style={{ background: surface }} className="relative overflow-hidden py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              {contactSection?.title || "Get in touch"}
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-black/55 max-w-lg mx-auto lg:mx-0">
              {contactSection?.subtitle || "Have a question or special request? Drop us a line."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start">
              {features.map((f) => (
                <div key={f.label} className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.02] px-4 py-2 text-xs font-medium text-black/70">
                  <span style={{ color: primary }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 md:p-8">
              <div className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-black/60">Full name</span>
                    <input value={form.fullName} onChange={onChange("fullName")} placeholder="Your name" className="h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none placeholder:text-black/30" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-black/60">Email</span>
                    <input value={form.email} onChange={onChange("email")} placeholder="you@example.com" type="email" className="h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none placeholder:text-black/30" />
                  </label>
                </div>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-black/60">Message</span>
                  <textarea value={form.message} onChange={onChange("message")} placeholder="How can we help?" rows={5} className="w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 py-3 text-sm outline-none placeholder:text-black/30 resize-none" />
                </label>
                <button
                  type="button"
                  disabled={disabled}
                  className="h-12 w-full rounded-full text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: primary, color: "white" }}
                >
                  {(contactSection?.buttonLabel as string) || "Send message"}
                </button>
                <p className="text-[11px] text-black/40 text-center leading-relaxed">
                  By submitting, you agree we may contact you at the email provided.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
