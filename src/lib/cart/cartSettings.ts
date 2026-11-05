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
  /**
   * The owner's "Offer pickup" switch (F54 L-10 D5, owner answer 2):
   * `cart.offerPickup`. Only a stored `false` turns Pickup off, so every cart
   * saved before the switch existed keeps Pickup. Separate from `pickup.on`,
   * the pickup time picker.
   */
  offerPickup: boolean;
  /**
   * F58 (OD-02): the owner's "Let customers choose a delivery day" switch,
   * `cart.deliveryDay.on`. Only a stored `true` is on, as VR_Client_API reads
   * it (`deliveryDayOn`), so the cart offers days exactly when checkout takes
   * one. Off, the cart is today's and says the shop will confirm the day.
   */
  deliveryDay: { on: boolean };
  /**
   * F59 (OD-03, OD-04): the shop's flat shipping rates and "free over"
   * amount, `cart.shipping`, read the way VR_Client_API charges them
   * (`readShipping`): a rate that is not the saved shape is dropped, at most
   * five, cents only. No rates is today's cart and today's free shipping.
   */
  shipping: { rates: ShipRate[]; freeOverCents: number | null };
}

/** One flat shipping rate as Secure S4 saves it; `id` is what checkout is sent. */
export interface ShipRate {
  id: string;
  name: string;
  amountCents: number;
  estimate: string | null;
}

const SHIP_RATE_ID = /^[a-z0-9-]{1,40}$/;
const MAX_SHIP_RATES = 5;

function isShipRate(rate: unknown): rate is ShipRate {
  if (typeof rate !== 'object' || rate === null || Array.isArray(rate)) return false;
  const r = rate as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  return (
    typeof r.id === 'string' && SHIP_RATE_ID.test(r.id) &&
    name.length > 0 && name.length <= 40 &&
    typeof r.amountCents === 'number' && Number.isInteger(r.amountCents) && r.amountCents >= 0 && r.amountCents <= 100000
  );
}

/** `cart.shipping`, each rate only when it is the saved shape (Client's `readShipping`, rule for rule). */
function readShipping(raw: unknown): CartSettings['shipping'] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { rates: [], freeOverCents: null };
  const shipping = raw as Record<string, unknown>;
  const rates = Array.isArray(shipping.rates) ? shipping.rates.filter(isShipRate) : [];
  const freeOver = shipping.freeOverCents;
  return {
    rates: rates.slice(0, MAX_SHIP_RATES).map((rate) => ({
      id: rate.id,
      name: rate.name.trim(),
      amountCents: rate.amountCents,
      estimate: typeof rate.estimate === 'string' && rate.estimate.trim() ? rate.estimate.trim() : null,
    })),
    freeOverCents: typeof freeOver === 'number' && Number.isInteger(freeOver) && freeOver > 0 ? freeOver : null,
  };
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
  const deliveryDay = isRecord(c.deliveryDay) ? c.deliveryDay : {};
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
    offerPickup: c.offerPickup !== false,
    deliveryDay: { on: deliveryDay.on === true },
    shipping: readShipping(c.shipping),
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
 * saved: "Ship it to me" first when the shop ships, then Pickup when the
 * owner offers it (F54 L-10 D5), then Delivery when Local delivery is on and
 * shown.
 */
export function fulfilmentChoices(settings: CartSettings, ways: ShopWays): FulfilmentKind[] {
  if (!settings.saved) return [];
  return [
    ...(ways.ships ? (['ship'] as const) : []),
    ...(settings.offerPickup ? (['pickup'] as const) : []),
    ...(settings.showDelivery && ways.deliveryOn ? (['delivery'] as const) : []),
  ];
}

/** Whether checkout from the quick "Added to bag" card or Buy now must open the cart first. */
export function cartNeedsChoices(settings: CartSettings, ways: ShopWays): boolean {
  if (!settings.saved) return false;
  const choices = fulfilmentChoices(settings, ways);
  // Delivery as the only way (Pickup off, no shipping, F54 L-10 D5) still needs its ZIP checked in the cart,
  // and a cart with no way at all opens to say so rather than check out.
  return (
    settings.note.on ||
    settings.pickup.on ||
    settings.minimumOrder !== null ||
    choices.length > 1 ||
    choices[0] === 'delivery' ||
    cartHasNoWay(settings, choices)
  );
}

/** Shown in place of the checkout button when the cart offers no way to get the order. */
export const NO_WAY_TO_GET_ORDER = "This shop can't take online orders yet. Please contact the shop.";

/**
 * Whether a saved cart offers no way at all to get the order: Pickup off, no
 * shipping, and Delivery off or hidden (review note 1 on #226). Such a cart
 * never checks out; VR_Client_API refuses the same case with
 * NO_WAY_TO_GET_ORDER. A cart with no saved settings has no choices too, but
 * that is today's cart and checks out as before.
 */
export function cartHasNoWay(settings: CartSettings, choices: readonly FulfilmentKind[]): boolean {
  return settings.saved && choices.length === 0;
}

/** The shopper's current way: their pick when it is still offered, else the default (the first). */
export function currentKind(choices: readonly FulfilmentKind[], picked: FulfilmentKind | null): FulfilmentKind | null {
  return picked && choices.includes(picked) ? picked : choices[0] ?? null;
}

/**
 * What the cart sends, from the cart's state (the dialog calls this, so the
 * rule is tested by calling it). The way is sent only when the shopper had a
 * choice, when it is Delivery (its ZIP and fee are decided at checkout, so it
 * is never left out, even as the only way: a shop with Pickup off that only
 * delivers, F54 L-10 D5), or when it is Pickup with pickup times on; a cart
 * with no saved settings therefore sends nothing new at all.
 */
export function checkoutChoice(input: {
  settings: CartSettings;
  choices: readonly FulfilmentKind[];
  kind: FulfilmentKind | null;
  note: string;
  pickupAt: string | null;
  zip: string;
  /** F58: the delivery day the shopper picked (`YYYY-MM-DD`), sent only with the switch on and Delivery chosen. */
  deliveryOn?: string | null;
  /** F59: the shipping rate picked in the cart, sent only with Ship chosen and only when it is one of the shop's rates. */
  shipRateId?: string | null;
}): CheckoutChoice {
  const { settings, choices, kind } = input;
  const shipRateId =
    kind === 'ship' && input.shipRateId && settings.shipping.rates.some((rate) => rate.id === input.shipRateId) ? input.shipRateId : undefined;
  // A picked rate names the way even when Ship is the only one, so checkout charges that rate.
  const sendKind = kind !== null && (choices.length > 1 || kind === 'delivery' || (kind === 'pickup' && settings.pickup.on) || shipRateId !== undefined);
  const deliveryOn = settings.deliveryDay.on && kind === 'delivery' && input.deliveryOn ? input.deliveryOn : undefined;
  return {
    note: settings.saved && settings.note.on ? input.note : '',
    kind: sendKind ? kind : undefined,
    pickupAt: input.pickupAt ?? undefined,
    zip: input.zip,
    ...(deliveryOn ? { deliveryOn } : {}),
    ...(shipRateId ? { shipRateId } : {}),
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
/** A calendar day as VR_Client_API's checkout validator takes `deliveryOn` (`YYYY-MM-DD`). */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
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
  deliveryOn?: string;
  shipRateId?: string;
}

export interface CheckoutExtras {
  note?: string;
  fulfilment?: { kind: FulfilmentKind; pickupAt?: string; zip?: string; deliveryOn?: string; shipRateId?: string };
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
    const day = typeof choice.deliveryOn === 'string' && DAY.test(choice.deliveryOn) ? choice.deliveryOn : null;
    out.fulfilment = day ? { kind: 'delivery', zip: choice.zip, deliveryOn: day } : { kind: 'delivery', zip: choice.zip };
  } else if (choice.kind === 'ship') {
    out.fulfilment =
      typeof choice.shipRateId === 'string' && SHIP_RATE_ID.test(choice.shipRateId) ? { kind: 'ship', shipRateId: choice.shipRateId } : { kind: 'ship' };
  } else if (choice.kind === 'pickup') {
    out.fulfilment = typeof choice.pickupAt === 'string' && ISO.test(choice.pickupAt) ? { kind: 'pickup', pickupAt: choice.pickupAt } : { kind: 'pickup' };
  }
  return out;
}

/**
 * The server-side half: what `/api/checkout` forwards from a browser body.
 * Only `note` and `fulfilment.{kind,pickupAt,zip,deliveryOn,shipRateId}`, re-checked here; any fee
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
    deliveryOn: typeof f.deliveryOn === 'string' ? f.deliveryOn : undefined,
    shipRateId: typeof f.shipRateId === 'string' ? f.shipRateId : undefined,
  } as CheckoutChoice);
}

export interface DeliveryQuote {
  inArea: boolean;
  /**
   * VR_Client_API's answer (#135, F54 L-10 D6): `in-area`, `out-of-area`,
   * `zip-not-recognized`, `origin-not-configured`, or `price-missing` (an
   * in-area zone with no price, never free). Null from an older Client.
   */
  status: string | null;
  feeCents: number | null;
  waived: boolean;
  /**
   * Whether the shop offers pickup (`cart.offerPickup`, #135). An older
   * Client sends none, which reads as offered, so the cart's own choices
   * decide.
   */
  pickupOffered: boolean;
  /** The server's sentence for this status, shown as is. */
  words: string;
  /**
   * F58 (CL5): the days the customer may pick (`YYYY-MM-DD`, the next 14 on
   * the shop's clock), only on an in-area quote with the shop's delivery day
   * switch on. Null when the quote carries none.
   */
  deliveryDates: string[] | null;
}

/** `cartQuote`'s `delivery` answer, or null when absent or malformed. */
export function readDeliveryQuote(raw: unknown): DeliveryQuote | null {
  if (!isRecord(raw) || !isRecord(raw.delivery)) return null;
  const d = raw.delivery;
  if (typeof d.inArea !== 'boolean' || typeof d.words !== 'string' || !d.words.trim()) return null;
  const fee = typeof d.feeCents === 'number' && Number.isInteger(d.feeCents) && d.feeCents >= 0 ? d.feeCents : null;
  const status = typeof d.status === 'string' && d.status.trim() ? d.status.trim() : null;
  const dates = Array.isArray(d.deliveryDates) ? d.deliveryDates.filter((day): day is string => typeof day === 'string' && DAY.test(day)) : null;
  return {
    inArea: d.inArea,
    status,
    feeCents: fee,
    waived: d.waived === true,
    pickupOffered: d.pickupOffered !== false,
    words: d.words.trim(),
    deliveryDates: d.inArea && dates ? dates : null,
  };
}

export const PICKUP_IS_AVAILABLE = 'Pickup is available.';

/**
 * The line under the ZIP box (F54 L-10 D6): the server's words for its
 * answer, and "Pickup is available." after a no only when pickup really is
 * offered, by the shop (the quote) and in this cart (its choices). Only an
 * out-of-area answer gets it (review B1): VR_Client_API sends that one as the
 * headline alone, leaving the cart to offer pickup in its place
 * (`shopRules.js` `deliveryWords`), while a ZIP it could not check and a zone
 * with no price arrive as complete sentences with their own way forward. No
 * status is an older Client, which keeps today's words.
 */
export function deliveryAnswerLine(quote: DeliveryQuote, cartOffersPickup: boolean): string {
  const outOfArea = quote.status === 'out-of-area' || quote.status === null;
  if (quote.inArea || !outOfArea || !quote.pickupOffered || !cartOffersPickup) return quote.words;
  return `${quote.words} ${PICKUP_IS_AVAILABLE}`;
}

/** Shown with Delivery chosen (F54 L-10 D11, owner answer 3): the cart takes no day. */
export const DELIVERY_DAY_NOTE = 'The shop will confirm your delivery day.';

/** F58: the heading over the days the shopper may pick. */
export const CHOOSE_DELIVERY_DAY = 'Choose your delivery day';

/**
 * F58 (OD-02): what the Delivery section says about the day. With the
 * switch off, today's note, word for word. With it on, nothing until the ZIP
 * is checked (the days depend on the zone), then the quote's days to pick
 * from, or the note when an in-area quote offers none (the shop arranges the
 * day, as checkout does for a delivery that names none).
 */
export function deliveryDaySection(settings: CartSettings, quote: DeliveryQuote | null): { show: 'note' } | { show: 'days'; dates: string[] } | { show: 'none' } {
  if (!settings.deliveryDay.on) return { show: 'note' };
  if (!quote || !quote.inArea) return { show: 'none' };
  return quote.deliveryDates && quote.deliveryDates.length > 0 ? { show: 'days', dates: quote.deliveryDates } : { show: 'note' };
}

/** A `YYYY-MM-DD` day as the cart's day buttons show it: "Sat Mar 7". */
export function cartDayLabel(day: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(`${day}T12:00:00Z`))
    .replace(',', '');
}

/**
 * The words under each line in the cart (F54 L-10 D7). Nothing when the
 * customer chose Pickup or Delivery: neither ships, and "No shipping" there
 * read as "this cannot be delivered". Otherwise today's words.
 */
export function lineShippingNote(ships: boolean, kind: FulfilmentKind | null): string | null {
  if (kind === 'pickup' || kind === 'delivery') return null;
  return ships ? 'Shipping calculated at checkout' : 'No shipping';
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** The site's first enabled delivery check, pages in order, nested children included. */
function firstDeliveryCheck(blocks: unknown): Record<string, unknown> | null {
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    if (!isRecord(block)) continue;
    const type = isRecord(block.type) ? block.type : {};
    if (type.dispatchId === 'delivery-check' && block.enabled !== false) return block;
    const nested = firstDeliveryCheck(isRecord(block.config) ? block.config.children : undefined);
    if (nested) return nested;
  }
  return null;
}

/**
 * Whether the site's delivery check reads a zone table: its first binding
 * names a collection, the rule VR_Client_API's `zonesCollectionOf` decides
 * the area by.
 */
export function deliveryZonesBound(pages: unknown): boolean {
  for (const page of Array.isArray(pages) ? pages : []) {
    const block = firstDeliveryCheck(isRecord(page) ? page.blocks : undefined);
    if (!block) continue;
    const config = isRecord(block.config) ? block.config : {};
    const binding = Array.isArray(config.bindings) && isRecord(config.bindings[0]) ? config.bindings[0] : {};
    return typeof binding.collectionId === 'string' && OBJECT_ID.test(binding.collectionId);
  }
  return false;
}

/**
 * The miles for "We deliver within N miles." (F54 L-10 D9), or null to say
 * nothing: no default (an empty box is not 25 miles), and nothing when the
 * site has zones, because the zones decide the area and the single box can
 * disagree with them.
 */
export function deliveryRadiusLine(config: Record<string, unknown> | undefined, zonesBound: boolean): number | null {
  if (zonesBound || !config) return null;
  const miles = config.deliveryRadiusMiles;
  return typeof miles === 'number' && Number.isFinite(miles) && miles > 0 ? miles : null;
}

/** The IANA zone as Intl names it, or null for an unknown or missing one. */
function canonicalZone(zone: unknown): string | null {
  if (typeof zone !== 'string' || !zone.trim()) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone.trim() }).resolvedOptions().timeZone;
  } catch {
    // Intl throws RangeError for a zone it does not know: say nothing rather than guess.
    return null;
  }
}

/**
 * The line under the pickup times when the customer's clock is not the
 * shop's (F54 L-10 D10), for example "Times are Phoenix time." The times are
 * always the shop's; nothing when the zones match or either is unknown.
 */
export function shopTimeZoneNote(shopZone: unknown, browserZone: unknown): string | null {
  const shop = canonicalZone(shopZone);
  const browser = canonicalZone(browserZone);
  if (!shop || !browser || shop === browser) return null;
  const city = shop.split('/').pop()?.replace(/_/g, ' ');
  return city ? `Times are ${city} time.` : null;
}

/** The cart's total line for delivery: "Delivery $5", "Delivery free", or nothing. Display only. */
export function deliveryTotalLine(quote: DeliveryQuote | null): string | null {
  if (!quote || !quote.inArea) return null;
  if (quote.waived || quote.feeCents === 0) return 'Delivery free';
  return quote.feeCents === null ? null : `Delivery ${usd(quote.feeCents / 100)}`;
}

/** F59: the lowest rate, the first of equals in the shop's own order (Client's `lowestShipRate`), or null. */
export function lowestShipRate(rates: readonly ShipRate[]): ShipRate | null {
  return rates.reduce<ShipRate | null>((low, rate) => (low === null || rate.amountCents < low.amountCents ? rate : low), null);
}

/**
 * F59: the cart line when the shop has rates, "Shipping from $6, free over
 * $50" (the second half only with a free-over amount), or null. "From" is
 * true of Buy now too: with no pick checkout charges the lowest rate.
 */
export function shippingFromLine(shipping: CartSettings['shipping']): string | null {
  const lowest = lowestShipRate(shipping.rates);
  if (!lowest) return null;
  const from = `Shipping from ${usd(lowest.amountCents / 100)}`;
  return shipping.freeOverCents !== null ? `${from}, free over ${usd(shipping.freeOverCents / 100)}` : from;
}

export const CHOOSE_SHIPPING = 'Choose shipping';
export const FREE_SHIPPING = 'Free shipping';

/**
 * F59: what the cart shows about shipping once the way is Ship: the rates to
 * pick from, or "Free shipping" when the total after the code reaches the
 * free-over amount (checkout then charges $0 whichever rate), or nothing for
 * another way or a shop without rates.
 */
export function shippingSection(
  settings: CartSettings,
  kind: FulfilmentKind | null,
  totalDollars: number,
): { show: 'none' } | { show: 'free' } | { show: 'rates'; rates: ShipRate[] } {
  const { rates, freeOverCents } = settings.shipping;
  if (kind !== 'ship' || rates.length === 0) return { show: 'none' };
  if (freeOverCents !== null && Math.round(totalDollars * 100) >= freeOverCents) return { show: 'free' };
  return { show: 'rates', rates };
}

/** F59: the shopper's rate, their pick while it is still offered, else the lowest; null without rates. */
export function currentShipRate(rates: readonly ShipRate[], picked: string | null): string | null {
  if (picked && rates.some((rate) => rate.id === picked)) return picked;
  return lowestShipRate(rates)?.id ?? null;
}

/** A rate's price as the list shows it: "$6", "$6.50", or "Free" for $0. */
export function shipRateAmount(rate: ShipRate): string {
  return rate.amountCents === 0 ? 'Free' : usd(rate.amountCents / 100);
}

/** The ZIP as the cart sends it, or null. */
export function cleanZip(raw: string): string | null {
  const zip = raw.trim();
  return ZIP.test(zip) ? zip : null;
}
