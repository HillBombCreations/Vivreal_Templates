"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { confirmOrder } from "@/lib/confirmOrder";
import {
  resolveOrderConfirmation,
  type OrderConfirmationStatus,
  ORDER_CHECKING_COPY,
  ORDER_CHECK_TIMEOUT_MS,
  UNCONFIRMED_COPY,
  BACK_TO_SHOP_COPY,
  statusAfterTimeout,
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
 *
 * A check still running after ORDER_CHECK_TIMEOUT_MS shows the "could not
 * check" message. A late answer still replaces it, so a confirmation that
 * arrives after the timeout shows the card, matching the cart, which
 * ClearCartOnConfirmedOrder empties on that same answer.
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
    const timer = window.setTimeout(() => setStatus(statusAfterTimeout), ORDER_CHECK_TIMEOUT_MS);
    void resolveOrderConfirmation({ search: window.location.search, confirm: confirmOrder }).then((next) => {
      window.clearTimeout(timer);
      if (live) setStatus(next);
    });
    return () => {
      live = false;
      window.clearTimeout(timer);
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
              {UNCONFIRMED_COPY[status].heading}
            </h1>
            <p className="mb-8 leading-relaxed text-black/55">{UNCONFIRMED_COPY[status].body}</p>
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
