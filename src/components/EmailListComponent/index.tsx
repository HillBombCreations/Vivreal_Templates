"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { Button } from "@/components/ui/Button";
import { subscribeUser } from "@/lib/api/subscribe";
// Keys for localStorage
const SUBSCRIBE_KEY = "vivreal_subscribed";
const DISMISS_KEY = "vivreal_popup_dismissed_at";
const DAY_MS = 24 * 60 * 60 * 1000;

const EmailListComponent = () => {
  const siteData = useSiteData();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_MAIN_API;

  // Check popup logic
  useEffect(() => {
    const subscribed = localStorage.getItem(SUBSCRIBE_KEY);
    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    const now = Date.now();

    if (!subscribed) {
      if (!lastDismissed || now - parseInt(lastDismissed, 10) > DAY_MS) {
        // Show popup after a short delay
        const timer = setTimeout(() => setOpen(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError(true);
      return;
    }

    setIsSubmitting(true);
    setError(false);
    setSuccess(false);

    try {
      const success = await subscribeUser(email);
      if (success) {
        localStorage.setItem(SUBSCRIBE_KEY, "true");
        setSuccess(true);
        setEmail("");
        setTimeout(() => setOpen(false), 2000);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
      console.error("Subscription failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.4 }}
            className="w-[90%] max-w-lg rounded-2xl shadow-2xl border p-8 relative"
            style={{
              background: siteData?.surface,
              borderColor: siteData?.primary,
            }}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 cursor-pointer right-4 p-1 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Content */}
            <div className="text-center mb-8">
              <h2
                className="text-3xl font-bold mb-3"
                style={{ color: siteData?.primary }}
              >
                Stay Updated
              </h2>
              <p className="text-gray-700 text-lg">
                Enter your email and hit subscribe to get the latest news and updates.
              </p>
            </div>

            {success ? (
              <div className="rounded-lg bg-green-100 text-green-800 p-4 text-center font-medium">
                You’re now subscribed! 🎉
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="space-y-6 flex flex-col items-center"
              >
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    error ? "border-red-700" : "border-gray-300"
                  }`}
                  placeholder="Enter your email address"
                />

               

                {error && (
                  <p className="text-sm text-red-600 -mt-3">
                    Please enter a valid email address.
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  style={{
                    background: siteData?.primary,
                    color: siteData?.["text-inverse"],
                    cursor: "pointer",
                    minWidth: "180px",
                  }}
                >
                  {isSubmitting ? "Subscribing..." : "Subscribe"}
                </Button>
                 <p className="text-center text-xs text-gray-500">
                    By subscribing, you agree to receive updates from The Comedy Collective. 
                    You can unsubscribe anytime. See our{" "}
                    <a href="/privacy" className="underline">
                        Privacy Policy
                    </a>.
                </p>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailListComponent;