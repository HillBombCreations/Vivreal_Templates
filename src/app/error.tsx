'use client';

import QuotaExceeded from '@/components/QuotaExceeded';

export default function ErrorPage({
  error,
}: {
  error: Error & { status?: number; digest?: string };
}) {
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
      </div>
    </div>
  );
}
