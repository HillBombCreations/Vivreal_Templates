"use client";

import { useMemo, useState } from "react";
import { pickupWindows, slotWhenLabel, type PickupDay } from "@hillbombcreations/site-renderer";
import {
  cartDayLabel,
  CHOOSE_DELIVERY_DAY,
  CHOOSE_SHIPPING,
  FREE_SHIPPING,
  pickupOnlyLine,
  shipRateAmount,
  cleanZip,
  DELIVERY_DAY_NOTE,
  deliveryDaySection,
  deliveryAnswerLine,
  FULFILMENT_LABELS,
  NO_PICKUP_TIMES,
  NOTE_MAX,
  shopTimeZoneNote,
  type CartSettings,
  type DeliveryQuote,
  type FulfilmentKind,
  type shippingSection,
} from "@/lib/cart/cartSettings";

/**
 * The shopper's choices in the cart (owner ideas 2026-10-29, plan 3.9, 3.10;
 * T13, T15): Pickup or Delivery, the delivery ZIP and the server's answer,
 * a pickup time, and a note. Controlled: CartDialog owns the values, because
 * checkout sends them. Every rule here is shown, never trusted: VR_Client_API
 * re-checks each at checkout.
 */
export default function CartChoices({
  settings,
  choices,
  kind,
  onKind,
  shipping,
  shipRateId,
  onShipRateId,
  radiusMiles,
  zip,
  onZip,
  onCheckZip,
  checkingZip,
  delivery,
  deliveryOn,
  onDeliveryOn,
  hours,
  timeZone,
  pickupAt,
  onPickupAt,
  noPickupTimes,
  note,
  onNote,
  disabled,
}: {
  settings: CartSettings;
  choices: FulfilmentKind[];
  kind: FulfilmentKind | null;
  onKind: (kind: FulfilmentKind) => void;
  /** F59: the shipping rates to pick from, "Free shipping", or nothing (`shippingSection`). */
  shipping: ReturnType<typeof shippingSection>;
  shipRateId: string | null;
  onShipRateId: (id: string) => void;
  radiusMiles: number | null;
  zip: string;
  onZip: (zip: string) => void;
  onCheckZip: () => void;
  checkingZip: boolean;
  delivery: DeliveryQuote | null;
  /** F58: the delivery day the shopper picked, when the shop lets them. */
  deliveryOn: string | null;
  onDeliveryOn: (day: string) => void;
  hours: unknown;
  timeZone?: string;
  pickupAt: string | null;
  onPickupAt: (iso: string | null) => void;
  /** Pickup with pickup times on, and no time offered at all. */
  noPickupTimes: boolean;
  note: string;
  onNote: (note: string) => void;
  disabled: boolean;
}) {
  // Pickup times from the renderer's one rule (the server checks the same
  // one), recomputed when the cart opens. No time at all means no picker.
  const days: PickupDay[] = useMemo(
    () =>
      settings.pickup.on
        ? pickupWindows({ hours, timeZone, now: new Date(), noticeMinutes: settings.pickup.noticeMinutes, daysAhead: settings.pickup.daysAhead })
        : [],
    [settings.pickup.on, settings.pickup.noticeMinutes, settings.pickup.daysAhead, hours, timeZone],
  );
  const showPickupTimes = kind === "pickup" && days.some((d) => d.times.length > 0);
  const [day, setDay] = useState<string | null>(null);
  const activeDay = days.find((d) => d.date === day) ?? days.find((d) => d.times.length > 0) ?? null;
  // The cart renders only with items, which load from the browser after
  // hydration, so reading the browser's zone here never differs from a server render.
  const zoneNote = useMemo(() => shopTimeZoneNote(timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone), [timeZone]);
  // F58: the day note, the days to pick, or nothing until the ZIP is checked.
  const daySection = deliveryDaySection(settings, delivery);
  // F81 N-A2: one way, Pickup: no radio to read, so say it.
  const pickupOnly = pickupOnlyLine(choices);

  return (
    <div className="mb-3 space-y-3">
      {choices.length > 1 ? (
        <div
          role="radiogroup"
          aria-label="How you get your order"
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
        >
          {choices.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={kind === option}
              disabled={disabled}
              onClick={() => onKind(option)}
              className="h-10 cursor-pointer rounded-xl border text-sm font-semibold disabled:opacity-60"
              style={kind === option ? { borderColor: "var(--primary,#365b99)", color: "var(--primary,#365b99)" } : { borderColor: "rgba(0,0,0,0.1)" }}
            >
              {FULFILMENT_LABELS[option]}
            </button>
          ))}
        </div>
      ) : null}

      {pickupOnly ? (
        <div className="text-xs font-medium" role="status">
          {pickupOnly}
        </div>
      ) : null}

      {shipping.show === "free" ? (
        <div className="text-xs font-medium" role="status">
          {FREE_SHIPPING}
        </div>
      ) : null}

      {shipping.show === "rates" ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-black/55">{CHOOSE_SHIPPING}</div>
          <div role="radiogroup" aria-label={CHOOSE_SHIPPING} className="grid gap-1.5">
            {shipping.rates.map((rate) => (
              <button
                key={rate.id}
                type="button"
                role="radio"
                aria-checked={shipRateId === rate.id}
                disabled={disabled}
                onClick={() => onShipRateId(rate.id)}
                className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-left text-sm disabled:opacity-60"
                style={shipRateId === rate.id ? { borderColor: "var(--primary,#365b99)" } : { borderColor: "rgba(0,0,0,0.1)" }}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{rate.name}</span>
                  {rate.estimate ? <span className="block text-xs text-black/60">{rate.estimate}</span> : null}
                </span>
                <span className="shrink-0 font-semibold">{shipRateAmount(rate)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {kind === "delivery" ? (
        <div>
          {radiusMiles ? (
            <div className="mb-1.5 text-xs text-black/60">We deliver within {radiusMiles} miles.</div>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zip}
              onChange={(e) => onZip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCheckZip();
                }
              }}
              disabled={disabled || checkingZip}
              placeholder="Your ZIP"
              aria-label="Your ZIP"
              className="h-10 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-black/25 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={onCheckZip}
              disabled={disabled || checkingZip || !cleanZip(zip)}
              className="h-10 px-4 cursor-pointer rounded-xl border border-black/10 bg-white text-sm font-semibold hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check your ZIP
            </button>
          </div>
          {delivery ? (
            <div className="mt-1.5 text-xs font-medium" role="status">
              {deliveryAnswerLine(delivery, choices.includes("pickup"))}
            </div>
          ) : null}
          {daySection.show === "note" ? <div className="mt-1.5 text-xs text-black/60">{DELIVERY_DAY_NOTE}</div> : null}
          {daySection.show === "days" ? (
            <div className="mt-2">
              <div className="mb-1.5 text-xs font-semibold text-black/55">{CHOOSE_DELIVERY_DAY}</div>
              <div role="radiogroup" aria-label={CHOOSE_DELIVERY_DAY} className="flex gap-1.5 overflow-x-auto pb-1">
                {daySection.dates.map((day) => (
                  <button
                    key={day}
                    type="button"
                    role="radio"
                    aria-checked={deliveryOn === day}
                    disabled={disabled}
                    onClick={() => onDeliveryOn(day)}
                    className="h-9 shrink-0 cursor-pointer rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-60"
                    style={deliveryOn === day ? { borderColor: "var(--primary,#365b99)" } : { borderColor: "rgba(0,0,0,0.1)" }}
                  >
                    {cartDayLabel(day)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {noPickupTimes ? (
        <div className="text-xs font-medium" role="status">
          {NO_PICKUP_TIMES}
        </div>
      ) : null}

      {showPickupTimes ? (
        <div>
          <div className="mb-1.5 text-xs font-semibold text-black/55">Pickup time</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setDay(d.date);
                  onPickupAt(null);
                }}
                aria-pressed={activeDay?.date === d.date}
                className="h-9 shrink-0 cursor-pointer rounded-lg border px-2.5 text-xs font-semibold disabled:opacity-60"
                style={activeDay?.date === d.date ? { borderColor: "var(--primary,#365b99)" } : { borderColor: "rgba(0,0,0,0.1)" }}
              >
                {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${d.date}T12:00:00Z`)).replace(",", "")}
              </button>
            ))}
          </div>
          {activeDay && activeDay.times.length === 0 ? (
            <div className="mt-1.5 text-xs text-black/60">No pickup times this day</div>
          ) : (
            <select
              aria-label="Pickup time"
              value={pickupAt ?? ""}
              disabled={disabled}
              onChange={(e) => onPickupAt(e.target.value || null)}
              className="mt-1.5 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
            >
              <option value="">Pick a time</option>
              {(activeDay?.times ?? []).map((t) => (
                <option key={t.start} value={t.start}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          {pickupAt ? <div className="mt-1.5 text-xs font-semibold">Pickup {slotWhenLabel(pickupAt, timeZone)}</div> : null}
          {zoneNote ? <div className="mt-1.5 text-xs text-black/60">{zoneNote}</div> : null}
        </div>
      ) : null}

      {settings.note.on ? (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-black/55" htmlFor="vr-cart-note">
            {settings.note.label}
          </label>
          <textarea
            id="vr-cart-note"
            value={note}
            maxLength={NOTE_MAX}
            rows={2}
            disabled={disabled}
            onChange={(e) => onNote(e.target.value.slice(0, NOTE_MAX))}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/25 disabled:opacity-60"
          />
          <div className="text-right text-[11px] text-black/50">
            {note.length}/{NOTE_MAX}
          </div>
        </div>
      ) : null}
    </div>
  );
}
