'use client';

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import QuotaExceeded from '@/components/QuotaExceeded';

export default function ErrorPage({
  error,
}: {
  error: Error & { status?: number; digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  // 402 = quota exceeded / frozen account
  const isQuota = error.message?.includes('402') || error.status === 402;

  if (isQuota) {
    return <QuotaExceeded />;
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-base text-gray-500">
          We&apos;re having trouble loading this page. Please try again in a moment.
        </p>
        {/*
          RW4-7: the page had no way forward. A full reload, not `reset()`:
          this boundary mostly catches a server render that refused (the API
          did not answer), and only a new request can re-run that render.
        */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
