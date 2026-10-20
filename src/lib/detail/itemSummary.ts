/**
 * What an item's own detail page shows beyond the renderer's hero: the item's
 * authored outbound link as a primary action, and the facts the list card drew
 * that the generic detail hero never draws (V7 F-D1).
 *
 * THE DEFECT. Renderer 1.88.2 (R-D2) made a card link its item's own page while
 * Detail pages are on, ahead of the item's authored link (owner decision
 * 2026-10-19: the item page wins). The item page is the renderer's
 * `DetailPageTemplate`, whose generic hero draws an authored link only when the
 * item also carries `raw.ctaLabel` (`DetailPage/DetailHero.js`, "the label is
 * the opt-in"), and `fields.show` defaults to `[]`. The Studio switch writes
 * `detailPage { enabled, itemCollectionId }` with no `fields`. So a role on a
 * positions board linked to a page with its title and a back link, and its
 * apply URL appeared nowhere: applying was impossible. Its location, drawn on
 * the card, was gone too, because no detail section reads `raw.location`.
 *
 * WHICH LINK. The first present value in the order the renderer's layouts read
 * an item's own link, so the page acts on the link the card would have used:
 *   - `raw.link`, `raw.url`, `item.href`: ProductTilesLayout's tile `url`
 *     (`str(raw.link) ?? str(raw.url) ?? str(item.href)`). PositionsBoardLayout
 *     and CaseCardsLayout read the first and third of these
 *     (`str(raw.link) ?? str(item.href)`); `item.href` is itself derived from
 *     `link ?? url` (`mapItem.ts`), so the orders agree.
 *   - `raw.orderUrl`: ProductTilesLayout's float Order button,
 *     `tile.url ?? tile.orderUrl`.
 * `'#'` is the placeholder dead link the layouts treat as absent (ProductTiles:
 * `url !== "#"`), so it is skipped here too. Only an EXTERNAL link becomes the
 * action (`externalActionHref`): a relative one is the item's own address on
 * live data, never the link a card lost.
 *
 * WHICH CARD. The layout the visitor clicked: a binding on this page that
 * links its items here, else a binding on another page whose cards link into
 * this page (`inboundLinkBindings`, the renderer's link-into rule), so a
 * positions board on the home page keeps "Apply" and its facts on a careers
 * page that draws the collection differently or not at all.
 *
 * WHICH LABEL. The item's own (`raw.linkLabel`, which ProductTiles reads; then
 * `raw.ctaLabel`, which the detail hero reads), else the wording the source
 * layout put on that link, else a neutral "Visit".
 *
 * `fields`, READ AS THE RENDERER READS IT. `fields.show` is an additive
 * opt-in for extras (`DetailHero.js`, the Levain PDP round: "opt-in
 * info-column extras", the description and tags), never an allowlist that
 * removes defaults, so it ADDS facts here and removes nothing. `fields.hide`
 * is the renderer's opt-out (`DetailPageTemplate.js`, `hiddenFields`), and it
 * removes the action (`link`, `url` or `orderUrl`) or any fact by its key.
 *
 * Pure and dependency-free, so it runs under `node --test`.
 */
// Explicit `.ts` extensions: this module loads under the plain-Node runner.
import { allBlocks, inboundLinkBindings, itemBinding, type LinkBinding, type LinkPage } from './linkedItems.ts';

/** The item fields read here. `raw` is the item's `objectValue`, after any field map and context overlay. */
export interface SummaryItem {
  title?: string;
  href?: string;
  raw?: Record<string, unknown>;
}

export interface DetailItemAction {
  href: string;
  /** The visible words. */
  label: string;
  /** The accessible name: the words, the item they act on, and a new tab when there is one. */
  ariaLabel: string;
  /** Opens in a new tab with `noopener noreferrer`: an `http(s)` link, the renderer's rule. */
  external: boolean;
}

export interface DetailItemSummary {
  /** Lines of card facts, in the card's order. */
  facts: string[];
  action?: DetailItemAction;
}

export interface SummaryInput {
  /** The page whose detail route serves the item. */
  page: LinkPage;
  /** Every page of the site, home included, to find a card on another page that links here. */
  pages: readonly LinkPage[];
  /** The collection the item came from. */
  collectionId: string;
  item: SummaryItem;
  /** The page format the template renders with: it decides which hero draws. */
  format: string | undefined;
  /** `detailPage.fields`, as authored. */
  fields?: { show?: unknown; hide?: unknown } | null;
  /** The renderer's resolved detail sections for this page. */
  sections: readonly string[];
}

/** The neutral action wording when neither the item nor its layout names one. */
export const NEUTRAL_ACTION_LABEL = 'Visit';

/** The keys `fields.hide` can name to remove the action. */
const LINK_FIELD_KEYS: readonly string[] = ['link', 'url', 'orderUrl'];

/** The layouts whose card names the item's link or draws facts the hero does not. */
const WORDED_LAYOUTS: ReadonlySet<string> = new Set(['positions', 'product-tiles', 'case-cards']);

/** Formats the renderer gives their own hero (`DetailHero.js`); every other format gets the generic one. */
const OWN_HERO_FORMATS: ReadonlySet<string> = new Set(['products', 'shows', 'team']);

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Schemes a link may use. The same allowlist `mapItem.ts` applies to `item.href`. */
const SAFE_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * The scheme a browser would read from `value`, lower-cased with its colon, or
 * `undefined` when it has none (a relative value).
 *
 * The browser drops ASCII control characters and whitespace while it reads a
 * URL, so the scheme is read from the value with those removed
 * (`java<TAB>script:` is `javascript:` to a browser). Same strip as
 * `mapItem.ts`'s `safeLinkHref`, by code point for the reason given there.
 */
function linkScheme(value: string): string | undefined {
  const candidate = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('');
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(candidate)?.[0].toLowerCase();
}

/**
 * `value` when it may be drawn as the page's action, else `undefined`: an
 * EXTERNAL link only, `http(s)`, `mailto:` or `tel:`.
 *
 * Every relative value is refused, which is stricter than `mapItem.ts` on
 * purpose. There a relative link is how a card links inside the site. Here
 * the action exists for the link Detail pages took off the card, an outbound
 * one (an apply URL, an order page), and on live data a relative `link` is the
 * item's OWN address: the production census for F-D1 found 565 linked items on
 * pages this route serves, every one a same-site path such as
 * `/connections/facebook`, the help site's article links. Drawing those would
 * put a button on each article that leads back to an article. Refusing them
 * also refuses the relative values that leave the site (`//host`, a slash
 * then a backslash).
 */
export function externalActionHref(value: string): string | undefined {
  const scheme = linkScheme(value);
  return scheme !== undefined && SAFE_SCHEMES.has(scheme) ? value : undefined;
}

/**
 * Whether `href` opens in a new tab: the renderer's rule (`DetailHero.js`,
 * PositionsBoardLayout: `/^https?:\/\//i`), applied to the scheme the browser
 * reads, so an `http(s)` link written with a stray control character inside
 * (`ht<TAB>tps://`, which the browser navigates as https) behaves like every
 * other `http(s)` link.
 */
function opensInNewTab(href: string): boolean {
  const scheme = linkScheme(href);
  return scheme === 'http:' || scheme === 'https:';
}

type LinkField = 'link' | 'url' | 'href' | 'orderUrl';

/** The item's own link and the field it came from, in the layouts' order. */
function itemOwnLink(item: SummaryItem): { value: string; field: LinkField } | undefined {
  const raw = item.raw ?? {};
  const candidates: [LinkField, unknown][] = [
    ['link', raw.link],
    ['url', raw.url],
    ['href', item.href],
    ['orderUrl', raw.orderUrl],
  ];
  for (const [field, candidate] of candidates) {
    const value = str(candidate);
    if (value && value !== '#') return { value, field };
  }
  return undefined;
}

/**
 * The binding whose card the visitor followed here. This page's own bindings
 * that link here first (not opted out with `detailEligible: false`), then the
 * inbound ones in page order; among them the first with a worded layout, else
 * the first at all. Block resolution is `itemBinding`, the renderer's
 * `firstBinding`, shared with the page list's link rule.
 */
function sourceBinding(input: SummaryInput): LinkBinding | undefined {
  const own = allBlocks(input.page.blocks)
    .map(itemBinding)
    .filter((b): b is LinkBinding => b?.collectionId === input.collectionId && b.sectionConfig?.detailEligible !== false);
  const inbound = inboundLinkBindings(input.page, input.pages, input.collectionId).filter(
    (b) => b.sectionConfig?.detailEligible !== false,
  );
  const candidates = [...own, ...inbound];
  return candidates.find((b) => WORDED_LAYOUTS.has(str(b.displayAs) ?? '')) ?? candidates[0];
}

/** A binding's section config, read as a loose record. */
function configOf(binding: LinkBinding | undefined): Record<string, unknown> {
  // Cast: `sectionConfig` is a free-form record in the stored page; LinkBinding
  // declares only the keys the link rule reads.
  return (binding?.sectionConfig ?? {}) as Record<string, unknown>;
}

/**
 * The wording the source layout put on the item's own link (renderer 1.88.2).
 *   - positions: "Apply" (PositionsBoardLayout, the card's own action word).
 *   - product-tiles: the float Order button reads `sectionConfig.linkLabel ??
 *     "Order"`, and `orderUrl` is read only there; the other tile styles draw
 *     "Buy" (pastel), "Explore" (friends) and "Shop Now" (the default arm).
 * Every other layout makes the whole card the link and names no action.
 */
function layoutActionLabel(binding: LinkBinding | undefined, field: LinkField): string | undefined {
  const displayAs = str(binding?.displayAs);
  if (displayAs === 'positions') return 'Apply';
  if (displayAs !== 'product-tiles') return undefined;
  const config = configOf(binding);
  const tileStyle = str(config.tileStyle);
  if (field === 'orderUrl' || tileStyle === 'float') return str(config.linkLabel) ?? 'Order';
  if (tileStyle === 'pastel') return 'Buy';
  if (tileStyle === 'friends') return 'Explore';
  return 'Shop Now';
}

/** One card fact: the key `fields.show`/`fields.hide` name it by, and its value. */
type Fact = { key: string; value: string | undefined };

/** Every fact key this page knows how to read, and how the cards read it. */
function factValue(key: string, raw: Record<string, unknown>): string | undefined {
  switch (key) {
    case 'location':
      return str(raw.location);
    case 'type':
      return str(raw.type) ?? str(raw.employmentType);
    case 'pay':
      return str(raw.pay) ?? str(raw.compensation);
    case 'meta':
      return str(raw.meta);
    case 'subject':
      return str(raw.subject) ?? str(raw.demographic);
    default:
      return undefined;
  }
}

/**
 * The facts a source layout's card draws that the generic detail hero does
 * not, one array per line. The hero already draws the title and `item.price`,
 * so neither is here (a positions card's pay falls back to `item.price`; the
 * hero shows that).
 */
function layoutFacts(binding: LinkBinding | undefined, raw: Record<string, unknown>): Fact[][] {
  const fact = (key: string): Fact => ({ key, value: factValue(key, raw) });
  switch (str(binding?.displayAs)) {
    case 'positions':
      // PositionsBoardLayout: location under the title, then `type · pay`.
      return [[fact('location')], [fact('type'), fact('pay')]];
    case 'product-tiles':
      return [[fact('meta')]];
    case 'case-cards':
      return [[fact('subject')]];
    default:
      return [];
  }
}

/**
 * Whether the renderer's own hero already draws `raw.link` as a button: the
 * GENERIC hero does exactly when the item carries both `raw.link` and
 * `raw.ctaLabel` and the page renders a hero. The products, shows and team
 * heroes never read `raw.link`. Drawing ours too would be the same link twice.
 */
function heroDrawsOwnLink(input: SummaryInput): boolean {
  if (OWN_HERO_FORMATS.has(input.format ?? '')) return false;
  return input.sections.includes('hero') && !!str(input.item.raw?.link) && !!str(input.item.raw?.ctaLabel);
}

/**
 * The summary to draw under the hero, or `undefined` when there is nothing to
 * draw, in which case the page renders exactly as before.
 */
export function resolveDetailItemSummary(input: SummaryInput): DetailItemSummary | undefined {
  const raw = input.item.raw ?? {};
  const show = stringList(input.fields?.show);
  const hide = stringList(input.fields?.hide);
  const binding = sourceBinding(input);

  const lines = layoutFacts(binding, raw);
  const drawn = new Set(lines.flat().map((f) => f.key));
  // `fields.show` adds a known fact the card did not draw, each on its own line.
  for (const key of show) {
    if (drawn.has(key) || factValue(key, raw) === undefined) continue;
    drawn.add(key);
    lines.push([{ key, value: factValue(key, raw) }]);
  }
  const facts = lines
    .map((line) =>
      line
        .filter((fact) => fact.value !== undefined && !hide.includes(fact.key))
        .map((fact) => fact.value)
        .join(' · '),
    )
    .filter((line) => line !== '');

  let action: DetailItemAction | undefined;
  const own = itemOwnLink(input.item);
  if (own && !LINK_FIELD_KEYS.some((k) => hide.includes(k)) && !heroDrawsOwnLink(input)) {
    const href = externalActionHref(own.value);
    if (href) {
      const label =
        str(raw.linkLabel) ?? str(raw.ctaLabel) ?? layoutActionLabel(binding, own.field) ?? NEUTRAL_ACTION_LABEL;
      const external = opensInNewTab(href);
      const title = str(input.item.title) ?? str(raw.title);
      // `label: title`, the accessible name ProductTilesLayout gives its float
      // Order button, so "Apply" is "Apply: Baker" to a screen reader; plus the
      // new tab, which nothing on the button says.
      const ariaLabel = `${title ? `${label}: ${title}` : label}${external ? ' (opens in a new tab)' : ''}`;
      action = { href, label, ariaLabel, external };
    }
  }

  if (facts.length === 0 && !action) return undefined;
  return action ? { facts, action } : { facts };
}

/**
 * The item to hand the renderer's template. The hero draws `raw.link` with no
 * scheme check of its own whenever `raw.ctaLabel` is set, so a `raw.link`
 * whose scheme is not on the allowlist is removed from the copy it renders.
 * A relative link is left alone: that is a legitimate internal link there.
 * Everything else is the same object; the JSON-LD and metadata still read the
 * untouched item.
 */
export function withoutUnsafeHeroLink<T extends SummaryItem>(item: T): T {
  const link = str(item.raw?.link);
  if (!link || !str(item.raw?.ctaLabel)) return item;
  const scheme = linkScheme(link);
  if (scheme === undefined || SAFE_SCHEMES.has(scheme)) return item;
  const raw = { ...item.raw };
  delete raw.link;
  return { ...item, raw };
}

/**
 * The sections the hero draws INSIDE itself, gated on its own instance
 * listing them (`DetailPageTemplate.js`, `case 'hero'`: the product hero's
 * `interactiveSlot` reads `sections.includes('variants')` and
 * `sections.includes('addToCart')`; the shows hero's meta row the same way),
 * and skips standalone while the hero is present.
 */
const HERO_INLINE_SECTIONS: ReadonlySet<string> = new Set(['meta', 'variants', 'addToCart']);

/**
 * The sections a look's product page claims (`DetailPageTemplate.js`,
 * `LOOK_PAGE_SECTIONS`): the look draws itself once, in the first of these
 * its instance lists, and the rest render nothing.
 */
const LOOK_PAGE_SECTIONS: ReadonlySet<string> = new Set(['hero', 'variants', 'addToCart', 'vitals', 'specFacets']);

/**
 * The resolved section list split around the hero, so the summary can sit
 * directly under it.
 *
 * `before` is everything up to the hero plus the hero-inline sections listed
 * after it. They must stay with the hero: a product page whose first instance
 * was `['hero']` alone drew no size picker and no buy box at all (Delta 2
 * review, BLOCK 1). `after` is the rest without them, since a second instance
 * with no hero would draw them standalone, a second time.
 *
 * `lookShell`: the product page is a look's. `after` then also drops the
 * look's sections, so the look draws once, in `before`, and the summary sits
 * right under it rather than after the whole page.
 *
 * No hero: `before` is empty and `after` is the list unchanged, so a look that
 * claims a later section still draws (the summary goes first).
 */
export function splitAtHero<T extends string>(
  sections: readonly T[],
  options: { lookShell?: boolean } = {},
): { before: T[]; after: T[] } {
  // Cast: widening to `string` to search; `T` is a string union that may or may not name 'hero'.
  const heroAt = (sections as readonly string[]).indexOf('hero');
  if (heroAt === -1) return { before: [], after: [...sections] };
  const rest = sections.slice(heroAt + 1);
  return {
    before: [...sections.slice(0, heroAt + 1), ...rest.filter((s) => HERO_INLINE_SECTIONS.has(s))],
    after: rest.filter((s) => !HERO_INLINE_SECTIONS.has(s) && !(options.lookShell && LOOK_PAGE_SECTIONS.has(s))),
  };
}
