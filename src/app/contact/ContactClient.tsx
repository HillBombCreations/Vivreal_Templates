"use client";

import React, { useState } from "react";
import axios from "axios";
import { Button } from "@/components/UI/Button";
import { useSiteData } from "@/contexts/SiteDataContext";

const ContactClient = () => {
  const siteData = useSiteData();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_MAIN_API;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.subject.trim()) newErrors.subject = "Subject is required";
    if (!formData.message.trim()) newErrors.message = "Message is required";
    return newErrors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setError(false);
    setSuccess(false);

    try {
      await axios.post(`${API_URL}/api/sendContactUsEmail`, formData);
      setSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setError(true);
      console.error("Error sending message:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="max-w-3xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            <span style={{ color: siteData?.["text-primary"] }}>Contact</span>{" "}
            Us
          </h1>
          <p className="text-gray-700 text-lg md:text-xl max-w-2xl mx-auto">
            Have questions or just want to say hello? Fill out the form below
            and we’ll get back to you shortly.
          </p>
        </div>

        {/* Form */}
        <div
          style={{ background: siteData?.surface }}
          className="p-8 rounded-xl shadow-lg animate-fade-in"
        >
          {success && (
            <div className="mb-6 rounded-lg bg-green-100 text-green-800 p-4 text-center">
              We’ve received your message and will be in touch shortly.
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-red-100 text-red-800 p-4 text-center">
              Something went wrong. Please try again, or reach us directly at{" "}
              <a href="mailto:hello@example.com" className="underline font-medium">
                hello@example.com
              </a>
              .
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
              <label htmlFor="name" className="block mb-2 font-semibold">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  errors.name ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="Your full name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block mb-2 font-semibold">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  errors.email ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="your.email@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="subject" className="block mb-2 font-semibold">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  errors.subject ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="Subject of your message"
              />
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block mb-2 font-semibold">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={6}
                value={formData.message}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none ${
                  errors.message ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="Write your message here..."
              />
              {errors.message && (
                <p className="mt-1 text-sm text-red-600">{errors.message}</p>
              )}
            </div>

            <div className="text-center">
              <Button
                style={{
                  background: siteData?.primary,
                  color: siteData?.["text-inverse"],
                  cursor: "pointer",
                }}
                type="submit"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default ContactClient;