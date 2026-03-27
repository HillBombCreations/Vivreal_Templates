"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Mail, Clock, Users, X, CheckCircle2, AlertCircle } from "lucide-react";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-8 animate-pulse max-w-2xl mx-auto", children: [_jsx("div", { className: "h-7 w-1/2 rounded-lg bg-black/[0.06] mb-3" }), _jsx("div", { className: "h-4 w-3/4 rounded-lg bg-black/[0.04] mb-8" }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx("div", { className: "h-11 rounded-xl bg-black/[0.04]" }), _jsx("div", { className: "h-11 rounded-xl bg-black/[0.04]" })] }), _jsx("div", { className: "h-32 rounded-xl bg-black/[0.04]" }), _jsx("div", { className: "h-12 rounded-full bg-black/[0.06]" })] })] }));
}
/* ------------------------------------------------------------------ */
/*  Form Layout                                                        */
/* ------------------------------------------------------------------ */
export default function FormLayout({ items, accent, loading, previewMode, }) {
    const primary = accent || "var(--primary)";
    const [form, setForm] = useState({ fullName: "", email: "", message: "" });
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState({ open: false });
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const disabled = useMemo(() => {
        return !form.fullName || !form.email || !isValidEmail(form.email) || !form.message || submitting;
    }, [form, submitting]);
    const showToast = (next, ms = 4500) => {
        setToast(next);
        window.setTimeout(() => setToast({ open: false }), ms);
    };
    const onChange = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };
    const onSubmit = async () => {
        if (previewMode)
            return;
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
            if (!res.ok) {
                showToast({ open: true, type: "error", message: "Error sending message. Please try again." });
                return;
            }
            setForm({ fullName: "", email: "", message: "" });
            showToast({ open: true, type: "success", message: "Message sent! We'll get back to you soon." });
        }
        catch {
            showToast({ open: true, type: "error", message: "Network error. Please try again later." });
        }
        finally {
            setSubmitting(false);
        }
    };
    if (loading)
        return _jsx(Skeleton, {});
    // items is unused for FormLayout but required by ContentLayoutProps
    void items;
    const features = [
        { icon: _jsx(Mail, { className: "h-4 w-4" }), label: "Direct support" },
        { icon: _jsx(Clock, { className: "h-4 w-4" }), label: "Fast replies" },
        { icon: _jsx(Users, { className: "h-4 w-4" }), label: "Real humans" },
    ];
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-10 lg:grid-cols-[1fr_1.2fr] items-center min-h-[50vh]", children: [_jsx("div", { className: "flex flex-col gap-4", children: features.map((f) => (_jsxs("div", { className: "inline-flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-5 py-3.5 text-sm font-medium text-black/70 shadow-sm", children: [_jsx("span", { className: "h-9 w-9 rounded-lg flex items-center justify-center shrink-0", style: { background: `color-mix(in srgb, ${primary} 10%, transparent)`, color: primary }, children: f.icon }), f.label] }, f.label))) }), _jsx("div", { className: "w-full", children: _jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm p-6 md:p-8", children: _jsxs("div", { className: "grid gap-5", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Full name" }), _jsx("input", { value: form.fullName, onChange: onChange("fullName"), placeholder: "Your name", className: "h-11 w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30" })] }), _jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Email" }), _jsx("input", { value: form.email, onChange: onChange("email"), placeholder: "you@example.com", type: "email", className: `h-11 w-full rounded-xl border bg-black/[0.015] px-4 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30 ${form.email.length > 0 && !isValidEmail(form.email)
                                                            ? "border-red-400"
                                                            : "border-black/[0.08]"}` }), form.email.length > 0 && !isValidEmail(form.email) && (_jsx("span", { className: "text-[11px] text-red-500", children: "Please enter a valid email" }))] })] }), _jsxs("label", { className: "grid gap-1.5", children: [_jsx("span", { className: "text-xs font-medium text-black/60", children: "Message" }), _jsx("textarea", { value: form.message, onChange: onChange("message"), placeholder: "How can we help?", rows: 5, className: "w-full rounded-xl border border-black/[0.08] bg-black/[0.015] px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-black/[0.06] placeholder:text-black/30 resize-none" })] }), _jsx("button", { type: "button", onClick: onSubmit, disabled: submitting || previewMode, title: previewMode ? 'Preview only — form submission disabled' : undefined, className: "h-12 w-full cursor-pointer rounded-full text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed", style: { background: primary, color: "white" }, children: submitting ? (_jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [_jsx("span", { className: "h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" }), "Sending..."] })) : ("Send message") }), _jsx("p", { className: "text-[11px] text-black/40 text-center leading-relaxed", children: "By submitting, you agree we may contact you at the email provided." })] }) }) })] }), toast.open && (_jsx("div", { className: "fixed left-1/2 top-5 z-50 w-[92vw] max-w-md -translate-x-1/2 animate-fade-in", children: _jsx("div", { className: "rounded-xl border border-black/[0.06] bg-white px-4 py-3 shadow-lg", children: _jsxs("div", { className: "flex items-center gap-3", children: [toast.type === "success" ? (_jsx(CheckCircle2, { className: "h-5 w-5 shrink-0 text-emerald-500" })) : (_jsx(AlertCircle, { className: "h-5 w-5 shrink-0 text-red-500" })), _jsx("p", { className: "flex-1 text-sm text-black/80", children: toast.message }), _jsx("button", { type: "button", onClick: () => setToast({ open: false }), className: "cursor-pointer rounded-lg p-1 hover:bg-black/5 transition", "aria-label": "Close", children: _jsx(X, { className: "h-4 w-4 text-black/40" }) })] }) }) }))] }));
}
