import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import BookingClient from "@/components/Booking/BookingClient";
import SlugPage, { generateMetadata as slugMetadata } from "../[slug]/page";
import { getSiteData } from "@/lib/api/siteData";
import { assertUpstreamHealthy, isDegradedSiteData } from "@/lib/api/siteData/degraded";
import {
  BOOK_SLUG,
  bookingDays,
  decideBookPage,
  effectiveMode,
  initialServiceId,
  serviceChoices,
  serviceIds,
  staffChoices,
} from "@/lib/booking/bookPage";
import { resolveServiceNames } from "@/lib/booking/serviceNames";

/**
 * `/book` (owner ideas 2026-10-29, plan 3.4, 3.11, D29, D62; T2 and T14).
 *
 * A FIXED route, so switching booking on needs no site write. Next matches it
 * before `[slug]`, which is why booking OFF hands an owner's own `book` page
 * to the `[slug]` render (`decideBookPage`): that page keeps serving at its
 * address exactly as it did before this route existed. With booking off and
 * no such page, 404, as before.
 *
 * Always dynamic (plan 3.8, "must stay dynamic"): whether booking is on is
 * decided per request by VR_Client_API's lever, and the form is per visitor.
 */
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const BOOK_PARAMS = Promise.resolve({ slug: BOOK_SLUG });

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await connection();
  const siteData = await getSiteData();
  if (isDegradedSiteData(siteData)) return {};
  const decision = decideBookPage(siteData);
  if (decision.kind === "owner-page") return slugMetadata({ params: BOOK_PARAMS, searchParams });
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  if (decision.kind === "not-found") return { title: `Not Found | ${siteName}` };
  return { title: siteName ? `Book | ${siteName}` : "Book" };
}

export default async function BookPage({ searchParams }: Props) {
  await connection();
  const siteData = await getSiteData();
  // A degraded read must never 404 a page that exists: 5xx, come back later.
  assertUpstreamHealthy(siteData);
  const decision = decideBookPage(siteData);
  if (decision.kind === "owner-page") return SlugPage({ params: BOOK_PARAMS, searchParams });
  if (decision.kind === "not-found") return notFound();

  const staff = staffChoices(siteData.booking);
  const ids = serviceIds(siteData.booking);
  // Both forms offer the shop's named services ("What for"); a request with
  // none named takes free text instead.
  const services = ids.length > 0 ? serviceChoices(ids, await resolveServiceNames(siteData, ids)) : [];
  const mode = effectiveMode(decision.mode, services);
  const query = (await searchParams) ?? {};
  const shopName = siteData?.businessInfo?.name || siteData?.name || "";
  const shopPhone = siteData?.businessInfo?.contactInfo?.phoneNumber?.trim() || undefined;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
        <BookingClient
          mode={mode}
          shopName={shopName}
          shopPhone={shopPhone}
          timeZone={siteData.timezone}
          services={services}
          staff={staff}
          days={bookingDays(new Date(), siteData.timezone)}
          initialServiceId={initialServiceId(query.service, services)}
        />
      </main>
      <Footer />
    </>
  );
}
