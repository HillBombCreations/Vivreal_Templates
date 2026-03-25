'use client';

import { AlertTriangle } from 'lucide-react';

export default function QuotaExceeded() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Site Temporarily Unavailable
        </h1>
        <p className="mt-3 text-base text-gray-500 leading-relaxed">
          This site has reached its usage limit for the current billing period.
          The site owner has been notified and service will resume shortly.
        </p>
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-400">
            If you are the site owner, please check your account&apos;s usage and billing settings
            in the <span className="font-medium text-gray-600">Vivreal Portal</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
