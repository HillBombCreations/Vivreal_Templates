"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Loader2, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import {
  DOMAIN_SEARCH_COPY as COPY,
  SIMPLE_GET_INIT,
  availabilityUrl,
  evaluateQuery,
  messageForFailure,
  normalizeQuery,
  parseAvailability,
  parseSuggestions,
  registerHref,
  suggestionsUrl,
  type AvailabilityAnswer,
  type Suggestion,
} from "@/lib/domains/publicSearch";

/**
 * The public address search, and NOTHING ELSE.
 *
 * A RENDERING SHELL ONLY, on the rule `SiteConsent` states for itself: every
 * decision lives in `lib/domains/publicSearch.ts`, which imports neither React
 * nor Next so `node --test` can execute it. Templates' runner cannot load
 * either one, so logic that accumulates here becomes logic this repo cannot
 * test. Validation, URL building, response parsing, failure wording and every
 * visible string are all over there and all covered.
 *
 * THE FETCH IS A BARE `fetch(url, SIMPLE_GET_INIT)` AND HAS TO STAY ONE. The
 * domain service's distribution allows GET and HEAD and answers OPTIONS with a
 * 403 of its own, so a custom header, a Content-Type or credentials would make
 * the browser preflight and the preflight would die at the edge with a CORS
 * error that names nothing. `SIMPLE_GET_INIT` is frozen and a test pins its
 * key set.
 */
export default function DomainSearch() {
  const siteData = useSiteData();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<AvailabilityAnswer | null>(null);
  const [alternatives, setAlternatives] = useState<Suggestion[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);

  // Staleness guard, not an AbortController, matching the portal's buy flow. A
  // slow first search must not overwrite a fast second one; aborting would also
  // waste the limiter budget the first request already spent.
  const requestIdRef = useRef(0);

  const validity = useMemo(() => evaluateQuery(query), [query]);

  const accent = siteData?.primary || "#1a1a2e";
  const muted = siteData?.["text-secondary"] || "rgba(0,0,0,0.6)";

  const runSearch = useCallback(async () => {
    if (!validity.ok || busy) return;
    const domain = normalizeQuery(query);
    const reqId = ++requestIdRef.current;

    setBusy(true);
    setFailure(null);
    setAnswer(null);
    setAlternatives(null);
    setSearched(domain);

    // In parallel. They are separate routes because they cache for different
    // lengths of time, so the exact answer is never held up behind a second
    // registrar call for alternatives the visitor may never read.
    const [availability, suggestions] = await Promise.allSettled([
      fetch(availabilityUrl(domain), SIMPLE_GET_INIT),
      fetch(suggestionsUrl(domain), SIMPLE_GET_INIT),
    ]);

    if (requestIdRef.current !== reqId) return;

    if (availability.status !== "fulfilled") {
      // A rejected fetch is the network, or CORS. Either way there is no status
      // to read and no answer about the address.
      setFailure(messageForFailure(null));
      setBusy(false);
      return;
    }

    const res = availability.value;
    if (!res.ok) {
      setFailure(messageForFailure(res.status));
      setBusy(false);
      return;
    }

    const parsed = parseAvailability(await res.json().catch(() => null));
    if (requestIdRef.current !== reqId) return;
    if (!parsed) {
      setFailure(messageForFailure(null));
      setBusy(false);
      return;
    }
    setAnswer(parsed);

    // Alternatives are best effort. Losing them is a thinner page, not a wrong
    // one, so a failure here never replaces an answer that arrived.
    if (suggestions.status === "fulfilled" && suggestions.value.ok) {
      const list = parseSuggestions(await suggestions.value.json().catch(() => null));
      if (requestIdRef.current === reqId) setAlternatives(list);
    }

    if (requestIdRef.current === reqId) setBusy(false);
  }, [busy, query, validity.ok]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <label htmlFor="domain-query" className="sr-only">
          {COPY.inputLabel}
        </label>
        <input
          id="domain-query"
          name="domain"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={COPY.placeholder}
          aria-describedby={validity.hint ? "domain-query-hint" : undefined}
          className="min-h-12 flex-1 rounded-xl border border-black/15 bg-white px-4 text-base outline-none focus:border-black/40"
        />
        <button
          type="submit"
          disabled={!validity.ok || busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {COPY.checking}
            </>
          ) : (
            <>
              <Search className="h-4 w-4" aria-hidden="true" />
              {COPY.submit}
            </>
          )}
        </button>
      </form>

      {validity.hint ? (
        <p id="domain-query-hint" className="mt-2 text-sm" style={{ color: muted }}>
          {validity.hint}
        </p>
      ) : null}

      {/* One live region for every outcome, so a screen reader hears the answer
          once rather than hearing each card announce itself. */}
      <div aria-live="polite" className="mt-6">
        {failure ? (
          <p className="flex items-start gap-2 rounded-xl border border-black/15 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{failure}</span>
          </p>
        ) : null}

        {answer ? <Answer answer={answer} accent={accent} muted={muted} /> : null}

        {answer && alternatives && alternatives.length > 0 ? (
          <div className="mt-6">
            <h2 className="text-sm font-medium" style={{ color: muted }}>
              {COPY.alternativesHeading}
            </h2>
            <ul className="mt-2 space-y-2">
              {alternatives.map((item) => (
                <li key={item.domain}>
                  <Row
                    domain={item.domain}
                    displayPrice={item.price.displayPrice}
                    accent={accent}
                    muted={muted}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {answer && answer.status !== "available" && alternatives && alternatives.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: muted }}>
            {COPY.noAlternatives}
          </p>
        ) : null}
      </div>

      {/* The offer, stated BEFORE anyone searches rather than only after results
          come back, which is the one thing the signed-in hub still does not do.
          A stranger who leaves without searching has at least read it. */}
      <div className="mt-8 rounded-xl border border-black/15 p-4">
        <p className="text-sm font-medium">{COPY.freeYearHeading}</p>
        <p className="mt-1 text-sm" style={{ color: muted }}>
          {COPY.freeYearOffer}
        </p>
      </div>

      {searched ? (
        <p className="mt-4 text-sm" style={{ color: muted }}>
          {COPY.nextStepNote}
        </p>
      ) : null}
    </div>
  );
}

function Answer({
  answer,
  accent,
  muted,
}: {
  answer: AvailabilityAnswer;
  accent: string;
  muted: string;
}) {
  if (answer.status === "available") {
    return (
      <div className="rounded-xl border border-black/15 p-4">
        <p className="flex items-start gap-2 text-[15px] font-medium">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {/* break-all on the ADDRESS only, for the reason the portal's rows give:
              at 390px a long address loses more than half of itself and two
              results in the same search start to look identical. It used to wrap
              the whole sentence, which split the words after it too ("free to ta /
              ke." at 390, seen live 2026-09-16). The taken and unknown lines below
              already scope it this way. */}
          <span>
            <span className="break-all">{answer.domain}</span> {COPY.availableSuffix}
          </span>
        </p>
        <div className="mt-3">
          <Row
            domain={answer.domain}
            /* A price is rendered only when the service sent one. It never
               sends one for anything but `available`, and an available answer
               whose price could not be read shows the name and no number
               rather than a number we are not sure of. */
            displayPrice={answer.price?.displayPrice ?? null}
            accent={accent}
            muted={muted}
          />
        </div>
      </div>
    );
  }

  if (answer.status === "unsupported") {
    const ending = answer.domain.slice(answer.domain.lastIndexOf("."));
    return (
      <p className="rounded-xl border border-black/15 p-4 text-[15px]">
        {COPY.unsupportedPrefix} <span className="font-medium">{ending}</span>.{" "}
        {COPY.unsupportedSuffix}
      </p>
    );
  }

  if (answer.status === "unknown") {
    return (
      <p className="rounded-xl border border-black/15 p-4 text-[15px]">
        <span className="break-all font-medium">{answer.domain}</span> {COPY.unknownSuffix}
      </p>
    );
  }

  return (
    <p className="rounded-xl border border-black/15 p-4 text-[15px]">
      <span className="break-all font-medium">{answer.domain}</span> {COPY.takenSuffix}
    </p>
  );
}

function Row({
  domain,
  displayPrice,
  accent,
  muted,
}: {
  domain: string;
  displayPrice: string | null;
  accent: string;
  muted: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/15 p-3">
      <div className="min-w-0">
        <span className="break-all text-[15px] font-medium">{domain}</span>
        {displayPrice ? (
          <span className="mt-0.5 block text-xs" style={{ color: muted }}>
            ${displayPrice} {COPY.perYear}
          </span>
        ) : null}
      </div>
      {/* A plain anchor, not next/link. It leaves this app for the portal, which
          CloudFront serves from a different origin on the same host, so a
          client-side navigation would have nothing to navigate to. */}
      <a
        href={registerHref(domain)}
        className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-4 text-sm font-medium text-white"
        style={{ backgroundColor: accent }}
      >
        {COPY.choose}
        <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </div>
  );
}
