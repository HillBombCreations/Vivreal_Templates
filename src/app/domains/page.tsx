import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import DomainSearch from "@/components/DomainSearch";
import { getSiteData } from "@/lib/api/siteData";
import { buildRouteCanonicalMetadata } from "@/lib/seo/routeMetadata";
import { enforceDynamicUnlessIsr } from "@/lib/renderGate";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import {
  DOMAIN_GUIDE as GUIDE,
  DOMAIN_SEARCH_COPY as COPY,
  domainFaqSchema,
  servesPublicDomainSearch,
} from "@/lib/domains/publicSearch";

/**
 * `vivreal.io/domains`: the public address search.
 *
 * ── WHY THIS IS A ROUTE IN THIS REPO AND NOT A CMS PAGE ──────────────────
 *
 * vivreal.io is a Templates site rendered from the Vivreal group's CMS, so the
 * obvious home for a new page is authored content. It cannot be, because this
 * page is interactive: it takes a name, calls a service, and renders prices.
 * CMS content is composed from the renderer's registered components, and none
 * of the 161 does this. Adding one is a four-repo change (a renderer component,
 * a publish, a Templates bump, a portal palette entry plus a Studio config
 * editor) ending in a `promote-stable` that rebuilds every customer site in the
 * fleet, and the renderer is mid-release under a one-publish-one-bump rule. The
 * closest precedent, the delivery-check block, cost roughly 2,600 renderer
 * lines and three sibling repos.
 *
 * A hardcoded route costs this file, one client component and one tested
 * module. `/mcp`, `/llms.txt`, `/feeds/schedule.ics` and every `/api/*` handler
 * are already exactly this: paths this repo owns rather than the CMS.
 *
 * THE ENTRY POINT IS STILL CMS CONTENT. A link to here from the home page, the
 * nav and `/pricing` is authored in the Vivreal group like everything else on
 * that site, and this page does not create it.
 *
 * ── THE FLEET GATE, WHICH IS THE DANGEROUS PART ──────────────────────────
 *
 * A page file under `src/app/` is a STATIC route, and Next matches static
 * routes ahead of `[slug]`. Without a gate this page would exist on every
 * customer site in the fleet, selling Vivreal web addresses from a bakery's own
 * domain, and it would shadow any CMS page a customer ever slugs `domains`.
 * Verified 2026-09-08 against all five live sites: none has that slug today, so
 * nothing is being taken away, and the gate is what keeps that true.
 *
 * The gate reads `SITE_ID`, which is injected per Amplify app at deploy time.
 * Not the hostname: `lib/vivrealApex.ts` is the fleet's host predicate and it
 * says in its own docblock that it is browser-only, because reading the request
 * host on the server opts the route out of static rendering. A build-time env
 * var decides before a request exists and costs the render nothing.
 *
 * ── THE GUARD RUNS IN THE PAGE FUNCTION, NOT BELOW A SUSPENSE ────────────
 *
 * `src/app/page.tsx` carries the note this obeys: a Suspense boundary flushes a
 * 200 shell the moment it suspends, so a `notFound()` inside a suspended child
 * is a soft 200. There is no Suspense here and the gate is the first thing
 * after the ISR gate, so a customer site gets a real 404.
 */

// ISR migration Phase 3. Must be a literal: Next 16 parses route segment config
// out of this file's source and hard-fails the build on an expression. Kept in
// step with ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`) like every other
// route in the app.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  // Same gate as the page, for the same reason `src/app/page.tsx` gives: without
  // it a gate-off build would still run this function and make a `siteDetails`
  // read per route that the pre-ISR `force-dynamic` skipped entirely.
  await enforceDynamicUnlessIsr();
  if (!servesPublicDomainSearch(process.env.SITE_ID)) return {};

  const siteData = await getSiteData();
  return {
    // The search result is this page's front door, so it gets the phrasings
    // people type rather than the short in-page heading.
    title: COPY.metaTitle,
    description: COPY.metaDescription,
    ...buildRouteCanonicalMetadata(siteData, "/domains"),
  };
}

export default async function DomainsPage() {
  await enforceDynamicUnlessIsr();

  // Fails closed. An unset or unexpected SITE_ID renders no page rather than
  // the wrong one, which on a fleet app is the only safe direction.
  if (!servesPublicDomainSearch(process.env.SITE_ID)) notFound();

  return (
    <>
      <Navbar />
      <main className="content-grid py-16 md:py-24">
        <div className="mx-auto w-full max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{COPY.heading}</h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed md:text-lg">
            {COPY.intro}
          </p>
        </div>
        <div className="mt-10">
          <DomainSearch />
        </div>

        {/* The guide. Server-rendered on purpose: it is what a search engine
            reads, so it must be in the HTML, not behind the client component. */}
        <div className="mx-auto mt-20 w-full max-w-3xl space-y-14 text-base leading-relaxed md:text-lg">
          <section aria-labelledby="domains-what">
            <h2 id="domains-what" className="text-2xl font-bold tracking-tight md:text-3xl">
              {GUIDE.answerHeading}
            </h2>
            <p className="mt-4">{GUIDE.answer}</p>
          </section>

          <section aria-labelledby="domains-ways">
            <h2 id="domains-ways" className="text-2xl font-bold tracking-tight md:text-3xl">
              {GUIDE.waysHeading}
            </h2>
            {/* A real table, because it is tabular: the comparison is the
                content, and a crawler reads a table as one. Scrolls sideways on
                a phone rather than squeezing four columns into 390px. */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm md:text-base">
                <thead>
                  <tr>
                    {GUIDE.waysColumns.map((column, index) => (
                      <th
                        key={column || `col-${index}`}
                        scope="col"
                        className="border-b-2 py-3 pr-4 font-semibold"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GUIDE.ways.map((way) => (
                    <tr key={way.label} className="align-top">
                      <th scope="row" className="border-b py-4 pr-4 font-semibold">
                        {way.label}
                      </th>
                      <td className="border-b py-4 pr-4">{way.goodFor}</td>
                      <td className="border-b py-4 pr-4">{way.what}</td>
                      <td className="border-b py-4">{way.billing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="domains-cost">
            <h2 id="domains-cost" className="text-2xl font-bold tracking-tight md:text-3xl">
              {GUIDE.costHeading}
            </h2>
            <p className="mt-4">{GUIDE.cost}</p>
            <p className="mt-4 font-semibold">{COPY.freeYearOffer}</p>
            <p className="mt-4">
              <Link href="/pricing" className="font-semibold underline underline-offset-4">
                {GUIDE.pricingLinkLabel}
              </Link>
            </p>
          </section>

          <section aria-labelledby="domains-faq">
            <h2 id="domains-faq" className="text-2xl font-bold tracking-tight md:text-3xl">
              {GUIDE.faqHeading}
            </h2>
            <div className="mt-6 space-y-8">
              {GUIDE.faq.map((item) => (
                <div key={item.question}>
                  <h3 className="text-lg font-semibold md:text-xl">{item.question}</h3>
                  <p className="mt-2">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <JsonLd schema={domainFaqSchema()} />
      <Footer />
    </>
  );
}
