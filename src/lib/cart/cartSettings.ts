/**
 * Cart settings and delivery at the cart (owner ideas 2026-10-29, plan 3.9 and
 * 3.10, D49 to D57; T13 and T15). Pure, so `node --test` decides what the
 * cart shows and sends exactly as the dialog does.
 *
 * WHERE THE SETTINGS LIVE. `siteDetails.values.cart` (D51), written by
 * VR_Secure_API's `cartSettingsRule` and spread into site data with the rest
 * of `values`. Every field is optional; a missing or malformed field reads as
 * today's behaviour, so a site whose owner never opened the Cart section shows
 * exactly the words it shows today (`CART_DEFAULTS`).
 *
 * WHAT IS ENFORCED WHERE. The cart only ASKS: it disables the button under the
 * minimum, offers pickup times from the shared renderer rule, and shows the
 * delivery words VR_Client_API's `cartQuote` sends. VR_Client_API decides at
 * checkout (minimum after codes, delivery zone and fee, pickup slot), and the
 * cart never sends a fee (D57): `checkoutExtras` has no field for one.
 */

export const CART_DEFAULTS = Object.freeze({
  title: 'Your cart',
  emptyText: 'Your cart is empty',
  checkoutLabel: 'Proceed to checkout',
  noteLabel: 'Note for the shop',
});

/** The order note's cap (D55); VR_Client_API refuses longer with a 400. */
export const NOTE_MAX = 250;

const PICKUP_NOTICE_MINUTES: ReadonlySet<number> = new Set([30, 60, 120, 240, 1440]);

export interface CartSettings {
  /**
   * Whether the owner has saved cart settings at all (review B3, owner
   * decision 2026-10-29: opt-in). Until then the cart is exactly today's: no
   * Pickup, Delivery or Ship choice, and Buy now goes straight to checkout,
   * whatever Local delivery says.
   */
  saved: boolean;
  title: string;
  emptyText: string;
  checkoutLabel: string;
  note: { on: boolean; label: string };
  pickup: { on: boolean; noticeMinutes: number; daysAhead: number };
  /** Dollars, or null for none. */
  minimumOrder: number | null;
  /** Show the delivery line and choice when Local delivery is on. Default on. */
  showDelivery: boolean;
  /** Show the promo code box. Default on. */
  showPromo: boolean;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, max: number, fallback: string): string {
  if (typeof v !== 'string') return fallback;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : fallback;
}

/** The stored `cart` value, every field read defensively against today's defaults. */
export function readCartSettings(raw: unknown): CartSettings {
  const c = isRecord(raw) ? raw : {};
  const note = isRecord(c.note) ? c.note : {};
  const pickup = isRecord(c.pickup) ? c.pickup : {};
  const notice = typeof pickup.noticeMinutes === 'number' && PICKUP_NOTICE_MINUTES.has(pickup.noticeMinutes) ? pickup.noticeMinutes : 120;
  const days =
    typeof pickup.daysAhead === 'number' && Number.isInteger(pickup.daysAhead) && pickup.daysAhead >= 1 && pickup.daysAhead <= 14
      ? pickup.daysAhead
      : 7;
  const min = typeof c.minimumOrder === 'number' && Number.isFinite(c.minimumOrder) && c.minimumOrder > 0 ? c.minimumOrder : null;
  return {
    saved: isRecord(raw),
    title: text(c.title, 40, CART_DEFAULTS.title),
    emptyText: text(c.emptyText, 80, CART_DEFAULTS.emptyText),
    checkoutLabel: text(c.checkoutLabel, 30, CART_DEFAULTS.checkoutLabel),
    note: { on: note.on === true, label: text(note.label, 40, CART_DEFAULTS.noteLabel) },
    pickup: { on: pickup.on === true, noticeMinutes: notice, daysAhead: days },
    minimumOrder: min,
    showDelivery: c.showDelivery !== false,
    showPromo: c.showPromo !== false,
  };
}

const usd = (dollars: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: dollars % 1 === 0 ? 0 : 2 }).format(dollars);

/**
 * The line under a cart below its minimum, or null when it reaches it.
 * Compared in cents on the total after the code, the figure the server checks.
 */
export function minimumLine(totalDollars: number, minimumOrder: number | null): string | null {
  if (minimumOrder === null) return null;
  const shortCents = Math.round(minimumOrder * 100) - Math.round(totalDollars * 100);
  if (shortCents <= 0) return null;
  return `Minimum order ${usd(minimumOrder)}. Add ${usd(shortCents / 100)} more.`;
}

export type FulfilmentKind = 'ship' | 'pickup' | 'delivery';

export interface ShopWays {
  /** Local delivery is switched on (`deliveryConfigOf`). */
  deliveryOn: boolean;
  /** The shop ships orders (`shipsOrders(businessInfo)`). */
  ships: boolean;
}

/** The words on each choice. */
export const FULFILMENT_LABELS: Readonly<Record<FulfilmentKind, string>> = Object.freeze({
  ship: 'Ship it to me',
  pickup: 'Pickup',
  delivery: 'Delivery',
});

/**
 * The ways the cart offers, first one the default. None at all until the
 * owner has saved cart settings (review B3): that cart is today's. Once
 * saved: "Ship it to me" first when the shop ships, then Pickup, then
 * Delivery when Local delivery is on and shown.
 */
export function fulfilmentChoices(settings: CartSettings, ways: ShopWays): FulfilmentKind[] {
  if (!settings.saved) return [];
  return [
    ...(ways.ships ? (['ship'] as const) : []),
    'pickup' as const,
    ...(settings.showDelivery && ways.deliveryOn ? (['delivery'] as const) : []),
  ];
}

/** Whether checkout from the quick "Added to bag" card or Buy now must open the cart first. */
export function cartNeedsChoices(settings: CartSettings, ways: ShopWays): boolean {
  if (!settings.saved) return false;
  return settings.note.on || settings.pickup.on || settings.minimumOrder !== null || fulfilmentChoices(settings, ways).length > 1;
}

/** The shopper's current way: their pick when it is still offered, else the default (the first). */
export function currentKind(choices: readonly FulfilmentKind[], picked: FulfilmentKind | null): FulfilmentKind | null {
  return picked && choices.includes(picked) ? picked : choices[0] ?? null;
}

/**
 * What the cart sends, from the cart's state (the dialog calls this, so the
 * rule is tested by calling it). The way is sent only when the shopper had a
 * choice, or when it is Pickup with pickup times on; a cart with no saved
 * settings therefore sends nothing new at all.
 */
export function checkoutChoice(input: {
  settings: CartSettings;
  choices: readonly FulfilmentKind[];
  kind: FulfilmentKind | null;
  note: string;
  pickupAt: string | null;
  zip: string;
}): CheckoutChoice {
  const { settings, choices, kind } = input;
  const sendKind = kind !== null && (choices.length > 1 || (kind === 'pickup' && settings.pickup.on));
  return {
    note: settings.saved && settings.note.on ? input.note : '',
    kind: sendKind ? kind : undefined,
    pickupAt: input.pickupAt ?? undefined,
    zip: input.zip,
  };
}

/**
 * What still blocks checkout for the chosen way, or null. Shown, never
 * guessed past: VR_Client_API decides at checkout. Pickup with pickup times
 * on needs a time, and when no time is offered at all says so (review note 2:
 * otherwise every checkout would be refused).
 */
export function choiceBlock(input: {
  settings: CartSettings;
  kind: FulfilmentKind | null;
  pickupOffered: boolean;
  pickupAt: string | null;
  deliveryInArea: boolean;
}): 'no-pickup-times' | 'pick-a-time' | 'check-zip' | null {
  if (input.kind === 'delivery' && !input.deliveryInArea) return 'check-zip';
  if (input.kind === 'pickup' && input.settings.pickup.on) {
    if (!input.pickupOffered) return 'no-pickup-times';
    if (!input.pickupAt) return 'pick-a-time';
  }
  return null;
}

export const NO_PICKUP_TIMES = 'No pickup times right now.';

const ZIP = /^\d{5}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
// Every control character but tab, newline and carriage return (VR_Client_API's rule).
const CONTROL = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, 'g');

/** The note as checkout takes it: control characters removed, trimmed, cut to the cap. */
export function cleanNote(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(CONTROL, '').trim().slice(0, NOTE_MAX);
}

export interface CheckoutChoice {
  note?: string;
  kind?: FulfilmentKind;
  pickupAt?: string;
  zip?: string;
}

export interface CheckoutExtras {
  note?: string;
  fulfilment?: { kind: FulfilmentKind; pickupAt?: string; zip?: string };
}

/**
 * The note and fulfilment to send, from what the shopper chose. Nothing at all
 * for a cart with no settings and no choice, so its checkout body is
 * byte-identical to today's. NEVER a fee: there is no field for one.
 */
export function checkoutExtras(choice: CheckoutChoice): CheckoutExtras {
  const out: CheckoutExtras = {};
  const note = cleanNote(choice.note);
  if (note) out.note = note;
  if (choice.kind === 'delivery' && typeof choice.zip === 'string' && ZIP.test(choice.zip)) {
    out.fulfilment = { kind: 'delivery', zip: choice.zip };
  } else if (choice.kind === 'ship') {
    out.fulfilment = { kind: 'ship' };
  } else if (choice.kind === 'pickup') {
    out.fulfilment = typeof choice.pickupAt === 'string' && ISO.test(choice.pickupAt) ? { kind: 'pickup', pickupAt: choice.pickupAt } : { kind: 'pickup' };
  }
  return out;
}

/**
 * The server-side half: what `/api/checkout` forwards from a browser body.
 * Only `note` and `fulfilment.{kind,pickupAt,zip}`, re-checked here; any fee
 * key anywhere is dropped. Nothing without a site id, because VR_Client_API
 * reads the rules off the site and refuses either field without one.
 */
export function forwardedCheckoutExtras(body: unknown, siteIdPresent: boolean): CheckoutExtras {
  if (!siteIdPresent || !isRecord(body)) return {};
  const f = isRecord(body.fulfilment) ? body.fulfilment : {};
  return checkoutExtras({
    note: body.note,
    kind: f.kind === 'pickup' || f.kind === 'delivery' || f.kind === 'ship' ? f.kind : undefined,
    pickupAt: typeof f.pickupAt === 'string' ? f.pickupAt : undefined,
    zip: typeof f.zip === 'string' ? f.zip : undefined,
  } as CheckoutChoice);
}

export interface DeliveryQuote {
  inArea: boolean;
  feeCents: number | null;
  waived: boolean;
  /** The server's sentence, shown as is. */
  words: string;
}

/** `cartQuote`'s `delivery` answer, or null when absent or malformed. */
export function readDeliveryQuote(raw: unknown): DeliveryQuote | null {
  if (!isRecord(raw) || !isRecord(raw.delivery)) return null;
  const d = raw.delivery;
  if (typeof d.inArea !== 'boolean' || typeof d.words !== 'string' || !d.words.trim()) return null;
  const fee = typeof d.feeCents === 'number' && Number.isInteger(d.feeCents) && d.feeCents >= 0 ? d.feeCents : null;
  return { inArea: d.inArea, feeCents: fee, waived: d.waived === true, words: d.words.trim() };
}

/** The cart's total line for delivery: "Delivery $5", "Delivery free", or nothing. Display only. */
export function deliveryTotalLine(quote: DeliveryQuote | null): string | null {
  if (!quote || !quote.inArea) return null;
  if (quote.waived || quote.feeCents === 0) return 'Delivery free';
  return quote.feeCents === null ? null : `Delivery ${usd(quote.feeCents / 100)}`;
}

/** The ZIP as the cart sends it, or null. */
export function cleanZip(raw: string): string | null {
  const zip = raw.trim();
  return ZIP.test(zip) ? zip : null;
}
