"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookingManage, type BookingCancelResult, type ManagedBooking } from "@hillbombcreations/site-renderer";
import { MANAGE_TOKEN, readCancel, readLookup } from "@/lib/booking/bookingClient";

type View = { kind: "loading" } | { kind: "ready"; booking: ManagedBooking | null } | { kind: "error" };

/**
 * The customer's cancel link (owner ideas 2026-10-29, plan 3.4, T4):
 * `/booking/manage?t=<token>`, the address VR_Client_API puts in the booking
 * email. The renderer's `BookingManage` draws every state and word.
 *
 * The token is a bearer secret, so it is read once in the browser, taken off
 * the visible address at once (`history.replaceState`, so it is not left in
 * the history or a screenshot), and sent only in a POST body to the site's own
 * `/api/booking/{lookup,cancel}`. A missing or malformed token is the expired
 * link state with no request made.
 */
export default function BookingManageClient({
  shopName,
  shopPhone,
  timeZone,
}: {
  shopName: string;
  shopPhone?: string;
  timeZone?: string;
}) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const token = useRef<string>("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t") ?? "";
    if (url.searchParams.has("t")) {
      url.searchParams.delete("t");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    if (!MANAGE_TOKEN.test(t)) {
      setView({ kind: "ready", booking: null });
      return;
    }
    token.current = t;
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/booking/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: t }),
        });
        const found = readLookup(res.status, await res.json().catch(() => null));
        if (!live) return;
        if (found.kind === "found") setView({ kind: "ready", booking: found.booking });
        else if (found.kind === "invalid") setView({ kind: "ready", booking: null });
        else setView({ kind: "error" });
      } catch {
        if (live) setView({ kind: "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const onCancel = useCallback(async (): Promise<BookingCancelResult> => {
    try {
      const res = await fetch("/api/booking/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current }),
      });
      return readCancel(res.status, await res.json().catch(() => null));
    } catch {
      return "error";
    }
  }, []);

  if (view.kind === "loading") return <div className="min-h-[12rem]" aria-busy="true" />;
  if (view.kind === "error") {
    return (
      <p className="text-base" role="alert">
        We couldn&apos;t load your booking. Please try again in a minute.
      </p>
    );
  }
  return (
    <BookingManage
      shopName={shopName}
      shopPhone={shopPhone}
      timeZone={timeZone}
      booking={view.booking}
      onCancel={onCancel}
    />
  );
}
