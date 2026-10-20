/**
 * What an item's own detail page shows beyond the renderer's hero: the item's
 * authored outbound link as a primary action, and the facts the list card drew
 * that the generic detail hero never draws (V7 F-D1).
 *
 * THE DEFECT. Renderer 1.88.2 (R-D2) made a card link its item's own page while
 * Detail pages are on, ahead of the item's authored link (owner decision
 * 2026-10-19: the item page wins). The item page is the renderer's generic
 * `DetailPageTemplate`, whose hero draws an authored link only when the item
 * also carries `raw.ctaLabel` (`DetailPage/DetailHero.js`, "the label is the
 * opt-in"), and `fields.show` defaults to `[]`. The Studio switch writes
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
 * `url !== "#"`), so it is skipped here too.
 * Only an EXTERNAL link becomes the action (`externalActionHref`): a relative
 * one is the item's own address on live data, never the link a card lost.
 *
 * WHICH LABEL. The item's own (`raw.linkLabel`, which ProductTiles reads; then
 * `raw.ctaLabel`, which the detail hero reads), else the wording the source
 * layout put on that link, else a neutral "Visit".
 *
 * THE OWNER'S CHOICE WINS. An explicit `detailPage.fields.show` is honoured
 * exactly: the action draws only if it lists `link` (or `url`/`orderUrl`), and
 * a fact only if it lists that fact's key. `fields.hide` removes either.
 *
 * Pure and dependency-free, so it runs under `node --test`.
 */
/** The page shape read here. Structural, so the route's page type fits. */
export interface SummaryPage {
  blocks?: readonly SummaryBlock[] | null;
}

interface SummaryBinding {
  collectionId?: string | null;
  displayAs?: string | null;
  sectionConfig?: Record<string, unknown> | null;
}

interface SummaryBlock {
  type?: { kind?: string | null; dispatchId?: string | null } | null;
  config?: { bindings?: readonly SummaryBinding[] | null; children?: unknown } | null;
}

/** The item fields read here. `raw` is the item's `objectValue`, after any field map and context overlay. */
export interface SummaryItem {
  href?: string;
  raw?: Record<string, unknown>;
}

export interface DetailItemAction {
  href: string;
  label: string;
  /** `http(s)` only: opens in a new tab with `noopener noreferrer`, the renderer's rule. */
  external: boolean;
}

export interface DetailItemSummary {
  /** Lines of card facts, in the card's order. */
  facts: string[];
  action?: DetailItemAction;
}

export interface SummaryInput {
  page: SummaryPage;
  /** The collection this detail route serves. */
  collectionId: string;
  item: SummaryItem;
  /** `detailPage.fields`, as authored. */
  fields?: { show?: unknown; hide?: unknown } | null;
  /** The renderer's resolved detail sections for this page. */
  sections: readonly string[];
}

/** The neutral action wording when neither the item nor its layout names one. */
export const NEUTRAL_ACTION_LABEL = 'Visit';

/** The keys an explicit `fields.show` can name to keep the action. */
const LINK_FIELD_KEYS: readonly string[] = ['link', 'url', 'orderUrl'];

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
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
 * also refuses the relative values that leave the site (`//host`, `/\host`).
 */
export function externalActionHref(value: string): string | undefined {
  const scheme = linkScheme(value);
  return scheme !== undefined && SAFE_SCHEMES.has(scheme) ? value : undefined;
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

/** Top-level blocks and, recursively, group children (as `linkedItems.ts`'s `allBlocks`). */
function walkBlocks(blocks: readonly SummaryBlock[] | null | undefined, out: SummaryBlock[] = []): SummaryBlock[] {
  for (const block of blocks ?? []) {
    if (!block) continue;
    out.push(block);
    const children = block.config?.children;
    // Cast: `children` is the renderer's nested block list; only the optional
    // fields `SummaryBlock` declares are read.
    if (Array.isArray(children)) walkBlocks(children as SummaryBlock[], out);
  }
  return out;
}

/** The page's binding to `collectionId` that draws its list: the one whose layout the card came from. */
function sourceBinding(page: SummaryPage, collectionId: string): SummaryBinding | undefined {
  let firstMatch: SummaryBinding | undefined;
  for (const block of walkBlocks(page.blocks)) {
    for (const binding of block.config?.bindings ?? []) {
      if (binding?.collectionId !== collectionId) continue;
      if (str(binding.displayAs)) return binding;
      firstMatch ??= binding;
    }
  }
  return firstMatch;
}

/**
 * The wording the source layout put on the item's own link (renderer 1.88.2).
 *   - positions: "Apply" (PositionsBoardLayout, the card's own action word).
 *   - product-tiles: the float Order button reads `sectionConfig.linkLabel ??
 *     "Order"`, and `orderUrl` is read only there; the other tile styles draw
 *     "Buy" (pastel), "Explore" (friends) and "Shop Now" (the default arm).
 * Every other layout makes the whole card the link and names no action.
 */
function layoutActionLabel(binding: SummaryBinding | undefined, field: LinkField): string | undefined {
  const displayAs = str(binding?.displayAs);
  if (displayAs === 'positions') return 'Apply';
  if (displayAs !== 'product-tiles') return undefined;
  const config = binding?.sectionConfig ?? {};
  const tileStyle = str(config.tileStyle);
  if (field === 'orderUrl' || tileStyle === 'float') return str(config.linkLabel) ?? 'Order';
  if (tileStyle === 'pastel') return 'Buy';
  if (tileStyle === 'friends') return 'Explore';
  return 'Shop Now';
}

/** One card fact: the key `fields.show`/`fields.hide` name it by, and its value. */
type Fact = { key: string; value: string | undefined };

/**
 * The facts a source layout's card draws that the generic detail hero does
 * not, one array per line. The hero already draws the title and `item.price`,
 * so neither is here (a positions card's pay falls back to `item.price`; the
 * hero shows that).
 */
function layoutFacts(binding: SummaryBinding | undefined, raw: Record<string, unknown>): Fact[][] {
  const displayAs = str(binding?.displayAs);
  if (displayAs === 'positions') {
    // PositionsBoardLayout: location under the title, then `type · pay`.
    return [
      [{ key: 'location', value: str(raw.location) }],
      [
        { key: 'type', value: str(raw.type) ?? str(raw.employmentType) },
        { key: 'pay', value: str(raw.pay) ?? str(raw.compensation) },
      ],
    ];
  }
  if (displayAs === 'product-tiles') return [[{ key: 'meta', value: str(raw.meta) }]];
  if (displayAs === 'case-cards') return [[{ key: 'subject', value: str(raw.subject) ?? str(raw.demographic) }]];
  return [];
}

/**
 * Whether the renderer's own hero already draws `raw.link` as a button: it
 * does exactly when the item carries both `raw.link` and `raw.ctaLabel` and
 * the page renders a hero. Drawing ours too would be the same link twice.
 */
function heroDrawsOwnLink(item: SummaryItem, sections: readonly string[]): boolean {
  return sections.includes('hero') && !!str(item.raw?.link) && !!str(item.raw?.ctaLabel);
}

/**
 * The summary to draw under the hero, or `undefined` when there is nothing to
 * draw, in which case the page renders exactly as before.
 */
export function resolveDetailItemSummary(input: SummaryInput): DetailItemSummary | undefined {
  const raw = input.item.raw ?? {};
  const show = stringList(input.fields?.show);
  const hide = stringList(input.fields?.hide) ?? [];
  const allowed = (keys: readonly string[]): boolean =>
    (show === undefined || keys.some((k) => show.includes(k))) && !keys.some((k) => hide.includes(k));

  const binding = sourceBinding(input.page, input.collectionId);

  const facts = layoutFacts(binding, raw)
    .map((line) =>
      line
        .filter((fact) => fact.value !== undefined && allowed([fact.key]))
        .map((fact) => fact.value)
        .join(' · '),
    )
    .filter((line) => line !== '');

  let action: DetailItemAction | undefined;
  const own = itemOwnLink(input.item);
  if (own && allowed(LINK_FIELD_KEYS) && !heroDrawsOwnLink(input.item, input.sections)) {
    const href = externalActionHref(own.value);
    if (href) {
      action = {
        href,
        label:
          str(raw.linkLabel) ?? str(raw.ctaLabel) ?? layoutActionLabel(binding, own.field) ?? NEUTRAL_ACTION_LABEL,
        // The renderer's target rule (`DetailHero.js`, PositionsBoardLayout).
        external: /^https?:\/\//i.test(href),
      };
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

/** The sections the hero draws inline and skips standalone while it is present (`DetailPageTemplate`). */
const HERO_INLINE_SECTIONS: ReadonlySet<string> = new Set(['meta', 'variants', 'addToCart']);

/**
 * The resolved section list split around the hero, so the summary can sit
 * directly under it: `before` ends with the hero (empty when the page has no
 * hero), `after` is the rest, minus the sections the hero draws inline (in a
 * template instance without the hero those would render a second time).
 */
export function splitAtHero<T extends string>(sections: readonly T[]): { before: T[]; after: T[] } {
  // Cast: widening to `string` to search; `T` is a string union that may or may not name 'hero'.
  const heroAt = (sections as readonly string[]).indexOf('hero');
  if (heroAt === -1) return { before: [], after: [...sections] };
  return {
    before: sections.slice(0, heroAt + 1),
    after: sections.slice(heroAt + 1).filter((s) => !HERO_INLINE_SECTIONS.has(s)),
  };
}
