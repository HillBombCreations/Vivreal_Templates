/**
 * Read the reader's search query off a `format:'lookup'` page's URL.
 *
 * The renderer ships the whole results grammar (`composition/lookup.tsx`): it
 * ranks the bound collection against a query SERVER-SIDE so the page is
 * crawlable, shareable by URL and works with JavaScript off. But `composePage`
 * has no request — only a route does — so the query has to be handed in, and
 * this is the one thing standing between the shipped grammar and a working
 * search page.
 *
 * WHY THE PARAM NAME IS READ FROM THE PAGE and not hardcoded to `q`. The name
 * is authored twice, once on the hero that submits (`hero.search.queryParam`)
 * and once on the binding that receives it (`sectionConfig.queryParam`), and
 * the renderer already honours the second one when it builds its own re-query
 * links. If this file assumed `q` while a site authored something else, the
 * page would still render — with the collection UNFILTERED, at every URL. A
 * search that always returns everything looks like it worked, which is a worse
 * failure than a 404 and one no status check can see. So the page names the
 * param and the route obeys it.
 *
 * Returns `undefined` for a page that is not a lookup, so every other format
 * threads nothing and is unaffected.
 */

/** The renderer's own default, from `resolveLookup`. Keep the two in step. */
const DEFAULT_QUERY_PARAM = "q";

type Binding = { sectionConfig?: { queryParam?: unknown; queryFields?: unknown } };
type LookupPage = {
  format?: string;
  blocks?: Array<{ config?: { bindings?: unknown } } | null | undefined>;
};

/**
 * The param the page's results binding declares.
 *
 * `resolveLookup` takes the FIRST section that declares `queryFields`, so this
 * walks in the same order and stops at the same binding. Any other rule would
 * read the name off one binding while the renderer filtered another.
 */
export function lookupParamOf(page: LookupPage | null | undefined): string {
  for (const block of page?.blocks ?? []) {
    const bindings = block?.config?.bindings;
    if (!Array.isArray(bindings)) continue;
    for (const binding of bindings as Binding[]) {
      const config = binding?.sectionConfig;
      if (!config) continue;
      // Gate on queryFields, exactly as the renderer does: a binding with no
      // fields is not the results binding, whatever else it declares.
      if (!Array.isArray(config.queryFields) || config.queryFields.length === 0) continue;
      const name = config.queryParam;
      return typeof name === "string" && name.trim() ? name.trim() : DEFAULT_QUERY_PARAM;
    }
  }
  return DEFAULT_QUERY_PARAM;
}

export function readLookupQuery(
  sp: Record<string, string | string[] | undefined>,
  page: LookupPage | null | undefined,
): string | undefined {
  if (page?.format !== "lookup") return undefined;
  const raw = sp[lookupParamOf(page)];
  // A repeated param (`?q=a&q=b`) arrives as an array. Take the first rather
  // than joining: the field submits one value, so a second is somebody editing
  // the URL, and joining them would search for a string nobody typed.
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value : undefined;
}
