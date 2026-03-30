import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Mail, Clock, Users } from "lucide-react";
const ContactSection = ({ siteData, prefetchedData }) => {
    const contactSection = prefetchedData?.contactUs;
    const primary = siteData?.primary ?? "#1a1a2e";
    const surface = siteData?.surface ?? "#ffffff";
    const [form, setForm] = useState({ fullName: "", email: "", message: "" });
    const [loading] = useState(false);
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const disabled = useMemo(() => {
        return !form.fullName || !form.email || !isValidEmail(form.email) || !form.message || loading;
    }, [form, loading]);
    const onChange = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };
    const features = [
        { icon: _jsx(Mail, { className: "h-4 w-4" }), label: "Direct support" },
        { icon: _jsx(Clock, { className: "h-4 w-4" }), label: "Fast replies" },
        { icon: _jsx(Users, { className: "h-4 w-4" }), label: "Real humans" },
    ];
    return (_jsx("section", { style: { background: surface }, className: "relative overflow-hidden py-20 md:py-28", children: _jsx("div", { className: "max-w-7xl mx-auto px-5 sm:px-8 lg:px-12", children: _jsxs("div", { className: "grid gap-12 lg:grid-cols-2 items-center", children: [_jsxs("div", { className: "text-center lg:text-left", children: [_jsx("h2", { className: "text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight", children: contactSection?.title || "Get in touch" }), _jsx("p", { className: "mt-4 text-base md:text-lg leading-relaxed text-black/55 max-w-lg mx-auto lg:mx-0", children: contactSection?.subtitle || "Have a question or special request? Drop us a line." }), _jsx("div", { className: "mt-8 flex flex-wrap items-center gap-3 justify-center lg:justify-start", children: features.map((f) => (_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-black/[0.02] px-4 py-2 text-xs font-medium text-black/70", children: [_jsx("span", { style: { color: primary }, children: f.icon }), f.label] }, f.label))) })] }), _jsx("div", { className: "w-full", children: _jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 md:p-8", children: _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Full name" }), _jsx("input", { value: form.fullName, onChange: onChange("fullName"), placeholder: "Your name", className: "h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none placeholder:text-black/30" })] }), _jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Email" }), _jsx("input", { value: form.email, onChange: onChange("email"), placeholder: "you@example.com", type: "email", className: "h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none placeholder:text-black/30" })] })] }), _jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Message" }), _jsx("textarea", { value: form.message, onChange: onChange("message"), placeholder: "How can we help?", rows: 5, className: "w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 py-3 text-sm outline-none placeholder:text-black/30 resize-none" })] }), _jsx("button", { type: "button", disabled: disabled, className: "h-12 w-full rounded-full text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed", style: { background: primary, color: "white" }, children: contactSection?.buttonLabel || "Send message" }), _jsx("p", { className: "text-[11px] text-black/40 text-center leading-relaxed", children: "By submitting, you agree we may contact you at the email provided." })] }) }) })] }) }) }));
};
export default ContactSection;
