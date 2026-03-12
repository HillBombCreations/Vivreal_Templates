"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSiteData } from "@/contexts/SiteDataContext";
import { Star } from "lucide-react";
import { createReview } from "@/lib/api/review/client";

const ReviewClient = () => {
  const siteData = useSiteData();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    rating: 0,
    review: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const siteName = siteData?.businessInfo?.name || siteData?.name || 'us';
  const contactEmail = siteData?.businessInfo?.contactInfo?.email || '';

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (formData.rating === 0) newErrors.rating = "Please select a rating";
    if (!formData.review.trim()) newErrors.review = "Review cannot be empty";
    return newErrors;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [e.target.name]: "" }));
  };

  const handleRating = (value: number) => {
    setFormData((prev) => ({ ...prev, rating: value }));
    setErrors((prev) => ({ ...prev, rating: "" }));
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
      const ok = await createReview(formData);
      if (ok) {
        setSuccess(true);
        setFormData({ name: "", email: "", rating: 0, review: "" });
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
      console.error("Error submitting review:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            <span style={{ color: siteData?.["text-primary"] }}>
              Leave a Review
            </span>
          </h1>
          <p className="text-gray-700 text-lg md:text-xl max-w-2xl mx-auto">
            Had a great experience with <strong>{siteName}</strong>? Tell us
            how we did and help others discover us!
          </p>
        </div>

        <div
          style={{ background: siteData?.surface }}
          className="p-8 rounded-xl shadow-lg animate-fade-in"
        >
          {success && (
            <div className="mb-6 rounded-lg bg-green-100 text-green-800 p-4 text-center">
              Thanks for your review! We appreciate your feedback and support.
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-red-100 text-red-800 p-4 text-center">
              Something went wrong. Please try again later
              {contactEmail && (
                <>
                  {" "}or email us at{" "}
                  <a href={`mailto:${contactEmail}`} className="underline font-medium">
                    {contactEmail}
                  </a>
                </>
              )}
              .
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-6">
            <div>
              <label htmlFor="name" className="block mb-2 font-semibold">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                  errors.name ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="Your name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block mb-2 font-semibold">Email</label>
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
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="block mb-2 font-semibold">Rating</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-8 w-8 cursor-pointer transition ${
                      formData.rating >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                    onClick={() => handleRating(star)}
                  />
                ))}
              </div>
              {errors.rating && <p className="mt-1 text-sm text-red-600">{errors.rating}</p>}
            </div>

            <div>
              <label htmlFor="review" className="block mb-2 font-semibold">Your Review</label>
              <textarea
                id="review"
                name="review"
                rows={6}
                value={formData.review}
                onChange={handleChange}
                className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none ${
                  errors.review ? "border-red-700" : "border-gray-300"
                }`}
                placeholder="Share your thoughts about your experience..."
              />
              {errors.review && <p className="mt-1 text-sm text-red-600">{errors.review}</p>}
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
                {isSubmitting ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
};

export default ReviewClient;
