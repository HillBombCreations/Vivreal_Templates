"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { confirmOrder } from "@/lib/confirmOrder";
import {
  resolveOrderConfirmation,
  type OrderConfirmationStatus,
  ORDER_CHECKING_COPY,
  ORDER_NOT_FOUND_HEADING,
  ORDER_NOT_FOUND_BODY,
  BACK_TO_SHOP_COPY,
} from "@/lib/orderConfirmationGate";

/**
 * Shows the success page's "Order confirmed!" card only for an order the
 * server confirmed paid (TB-5). The decision, and why, is in
 * `lib/orderConfirmationGate.ts`.
 *
 * Starts at "checking" on both the server and the client, so the ISR-cached
 * HTML never carries the congratulations and hydration matches. The URL is
 * read in the effect, never in a state initializer (see
 * OrderConfirmationTrigger.tsx for why).
 */
export default function ConfirmedOrderGate({
  shopHref,
  children,
}: {
  shopHref: string;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<OrderConfirmationStatus>("checking");

  useEffect(() => {
    let live = true;
    void resolveOrderConfirmation({ search: window.location.search, confirm: confirmOrder }).then((next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (status === "confirmed") return <>{children}</>;

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md py-16 text-center">
        {status === "checking" ? (
          <p role="status" className="text-black/55">
            {ORDER_CHECKING_COPY}
          </p>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {ORDER_NOT_FOUND_HEADING}
            </h1>
            <p className="mb-8 leading-relaxed text-black/55">{ORDER_NOT_FOUND_BODY}</p>
            <Link
              href={shopHref}
              className="inline-flex h-11 items-center rounded-2xl bg-[var(--primary,#365b99)] px-6 font-semibold text-white"
            >
              {BACK_TO_SHOP_COPY}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
