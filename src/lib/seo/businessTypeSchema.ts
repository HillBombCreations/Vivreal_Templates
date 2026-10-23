/**
 * "What kind of business" (`businessInfo.businessType`) to schema.org, and to
 * the plain words a search summary may use (discovery batch 3.6, 3.10 item 16).
 *
 * The keys are EXACTLY VR_Secure_API's allowlist (`src/shared/businessTypes.js`,
 * PR #366), which is the only gate on the field: the schema declares a plain
 * String, so an unknown value never reaches here through Secure, and one that
 * does anyway (an older write, a direct DB edit) is treated as unset.
 *
 * UNSET MEANS TODAY. A site with no `businessType` keeps exactly the output it
 * had before this map existed (the address-or-hours heuristic in
 * `buildSiteJsonLd`, the summaries in `pageMetaText.ts`). The template
 * industry is NOT read here: the portal's "What kind of business" picker
 * prefills from it (plan row P1), so the owner's saved choice is the one
 * source, and a site nobody has touched does not change on the promote.
 *
 * Pure, so it runs under `node --test`.
 */

export interface BusinessTypeEntry {
  /** The schema.org `@type` of the site node. */
  schemaType: string;
  /**
   * A place customers visit (a LocalBusiness subtype): it may carry opening
   * hours. `false` for the Organization types, which never claim hours.
   */
  local: boolean;
  /** How a search summary names it, "a bakery". Absent for the catch-all. */
  words?: string;
  /** vivreal.io: also emit a SoftwareApplication node. */
  softwareApplication?: true;
}

export const BUSINESS_TYPE_SCHEMA: Readonly<Record<string, BusinessTypeEntry>> = Object.freeze({
  bakery: { schemaType: 'Bakery', local: true, words: 'a bakery' },
  brewery: { schemaType: 'Brewery', local: true, words: 'a brewery' },
  bar: { schemaType: 'BarOrPub', local: true, words: 'a bar' },
  cafe: { schemaType: 'CafeOrCoffeeShop', local: true, words: 'a cafe' },
  restaurant: { schemaType: 'Restaurant', local: true, words: 'a restaurant' },
  winery: { schemaType: 'Winery', local: true, words: 'a winery' },
  'hair-salon': { schemaType: 'HairSalon', local: true, words: 'a hair salon' },
  barber: { schemaType: 'HairSalon', local: true, words: 'a barber shop' },
  'beauty-salon': { schemaType: 'BeautySalon', local: true, words: 'a beauty salon' },
  'nail-salon': { schemaType: 'NailSalon', local: true, words: 'a nail salon' },
  'day-spa': { schemaType: 'DaySpa', local: true, words: 'a day spa' },
  'med-spa': { schemaType: 'HealthAndBeautyBusiness', local: true, words: 'a med spa' },
  florist: { schemaType: 'Florist', local: true, words: 'a florist' },
  gym: { schemaType: 'ExerciseGym', local: true, words: 'a gym' },
  clothing: { schemaType: 'ClothingStore', local: true, words: 'a clothing store' },
  store: { schemaType: 'Store', local: true, words: 'a shop' },
  'event-venue': { schemaType: 'EventVenue', local: true, words: 'an event venue' },
  lodging: { schemaType: 'LodgingBusiness', local: true, words: 'a place to stay' },
  'professional-service': { schemaType: 'ProfessionalService', local: true, words: 'a professional service' },
  legal: { schemaType: 'LegalService', local: true, words: 'a law practice' },
  'performing-group': { schemaType: 'PerformingGroup', local: false, words: 'a performing group' },
  'other-local': { schemaType: 'LocalBusiness', local: true },
  'online-business': { schemaType: 'Organization', local: false, words: 'an online business' },
  'software-company': { schemaType: 'Organization', local: false, words: 'a software company', softwareApplication: true },
});

/** The entry for a stored value, or `undefined` for unset, empty or unknown. */
export function resolveBusinessType(value: unknown): BusinessTypeEntry | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  return Object.prototype.hasOwnProperty.call(BUSINESS_TYPE_SCHEMA, value) ? BUSINESS_TYPE_SCHEMA[value] : undefined;
}
