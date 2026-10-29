import type { Metadata } from "next";
import { connection } from "next/server";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import BookingManageClient from "@/components/Booking/BookingManageClient";
import { getSiteData } from "@/lib/api/siteData";
import { assertUpstreamHealthy } from "@/lib/api/siteData/degraded";

/**
 * `/booking/manage` (owner ideas 2026-10-29, plan 3.4, T4): a customer's cancel
 * link. Always dynamic and never indexed. `referrer: no-referrer` keeps the
 * address, token included, out of any request the page makes to another site
 * before the browser takes the token off it (BookingManageClient).
 *
 * Served whether or not booking is on now: a customer holding a booking made
 * while it was on must still be able to see and cancel it.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  return {
    title: siteName ? `Your booking | ${siteName}` : "Your booking",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function BookingManagePage() {
  await connection();
  const siteData = await getSiteData();
  assertUpstreamHealthy(siteData);
  const shopName = siteData?.businessInfo?.name || siteData?.name || "";
  const shopPhone = siteData?.businessInfo?.contactInfo?.phoneNumber?.trim() || undefined;
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-14">
        <BookingManageClient shopName={shopName} shopPhone={shopPhone} timeZone={siteData.timezone} />
      </main>
      <Footer />
    </>
  );
}
