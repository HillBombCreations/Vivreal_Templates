"use client";

import { useCallback, useRef, useState } from "react";
import {
  BookingRequestForm,
  BookingSlotPicker,
  type BookingChoice,
  type BookingCreateResult,
  type BookingCreateValues,
  type BookingDay,
  type BookingQuery,
  type BookingRequestValues,
  type BookingSlot,
  type BookingSubmitResult,
} from "@hillbombcreations/site-renderer";
import { recordSiteGoal } from "@/lib/siteGoals";
import { slotsForDay } from "@/lib/booking/bookingClient";

/**
 * The `/book` forms (owner ideas 2026-10-29, plan 3.4, T2). The renderer draws
 * them and owns every word; this wires them to the site's own booking routes
 * (`/api/booking/*`, lib/booking/bookingProxy.ts) and records the booking
 * result for the owner's visit report (lib/siteGoals.ts).
 *
 * Online mode drops to the request form when VR_Client_API says the shop
 * takes requests, not bookings (`ONLINE_BOOKING_OFF` with `reason: request`,
 * D26), so a customer is never left with a form that cannot be sent.
 */
export default function BookingClient({
  mode: initialMode,
  shopName,
  shopPhone,
  timeZone,
  services,
  staff,
  days,
  initialServiceId,
}: {
  mode: "request" | "online";
  shopName: string;
  shopPhone?: string;
  timeZone?: string;
  services: BookingChoice[];
  staff: BookingChoice[];
  days: BookingDay[];
  initialServiceId?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const latest = useRef(0);

  const onRequest = useCallback(async (values: BookingRequestValues): Promise<BookingSubmitResult> => {
    try {
      const res = await fetch("/api/booking/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await res.json().catch(() => null)) as { ok?: unknown; emailed?: unknown } | null;
      if (!res.ok || body?.ok !== true) return { ok: false };
      recordSiteGoal("booking");
      return { ok: true, emailed: body.emailed === true };
    } catch {
      return { ok: false };
    }
  }, []);

  const onQueryChange = useCallback(async (query: BookingQuery) => {
    const ticket = ++latest.current;
    setSlots(null);
    const params = new URLSearchParams({ serviceItemId: query.serviceId, from: query.day });
    if (query.staffId) params.set("staffId", query.staffId);
    try {
      const res = await fetch(`/api/booking/slots?${params}`, { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (ticket !== latest.current) return; // a newer choice is already loading
      if (res.status === 409 && body?.reason === "request") {
        setMode("request");
        return;
      }
      setSlots(res.ok ? slotsForDay(body, query.day) : []);
    } catch {
      if (ticket === latest.current) setSlots([]);
    }
  }, []);

  const onBook = useCallback(async (values: BookingCreateValues): Promise<BookingCreateResult> => {
    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceItemId: values.serviceId,
          staffId: values.staffId,
          start: values.start,
          name: values.name,
          phone: values.phone,
          email: values.email,
          website: values.website,
        }),
      });
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.ok && body?.ok === true && typeof body.start === "string") {
        recordSiteGoal("booking");
        return {
          ok: true,
          serviceName: typeof body.serviceName === "string" && body.serviceName ? body.serviceName : services.find((s) => s.id === values.serviceId)?.name ?? "",
          ...(typeof body.staffName === "string" ? { staffName: body.staffName } : {}),
          start: body.start,
          email: typeof body.email === "string" ? body.email : values.email,
        };
      }
      if (res.status === 409 && body?.errorCode === "SLOT_TAKEN") {
        const next = Array.isArray(body.items) ? (body.items as BookingSlot[]) : [];
        return { ok: false, reason: "taken", next };
      }
      return { ok: false, reason: "error" };
    } catch {
      return { ok: false, reason: "error" };
    }
  }, [services]);

  if (mode === "online") {
    return (
      <BookingSlotPicker
        shopName={shopName}
        shopPhone={shopPhone}
        timeZone={timeZone}
        services={services}
        staff={staff}
        days={days}
        slots={slots}
        initialServiceId={initialServiceId}
        onQueryChange={onQueryChange}
        onBook={onBook}
      />
    );
  }
  return (
    <BookingRequestForm
      shopName={shopName}
      shopPhone={shopPhone}
      services={services}
      staff={staff}
      days={days}
      initialServiceId={initialServiceId}
      onSubmit={onRequest}
    />
  );
}
