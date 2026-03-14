"use client";

import Link from "next/link";
import { CheckCircle, XCircle } from "lucide-react";

interface CheckoutResultClientProps {
  success: boolean;
}

export default function CheckoutResultClient({ success }: CheckoutResultClientProps) {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center py-16">
        <div
          className="mx-auto mb-6 h-16 w-16 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: success ? "var(--primary, #365b99)" : undefined,
            opacity: success ? 0.1 : undefined,
          }}
        >
          {success ? (
            <CheckCircle className="h-8 w-8" style={{ color: "var(--primary, #365b99)" }} />
          ) : (
            <XCircle className="h-8 w-8 text-black/40" />
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          {success ? "Order confirmed!" : "Checkout cancelled"}
        </h1>
        <p className="text-black/55 mb-8 leading-relaxed">
          {success
            ? "Thank you for your purchase. You'll receive a confirmation email shortly with your order details."
            : "Your order was not placed. No charges were made. You can return to the store and try again whenever you're ready."}
        </p>
        <Link
          href="/"
          className="inline-flex h-11 px-6 items-center rounded-2xl font-semibold text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--primary, #365b99)" }}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
