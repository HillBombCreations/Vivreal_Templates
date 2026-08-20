'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  runConsentMount,
  grantConsent,
  denyConsent,
  withdrawConsent,
  type ConsentState,
  type VendorScript,
} from '@/lib/consent';

/**
 * The vivreal.io cookie-consent surface (G13 / C2) — banner + persistent
 * withdrawal control.
 *
 * A RENDERING SHELL ONLY. Every decision (apex gate, stored-choice restore,
 * GPC, vendor injection, withdrawal) lives in `lib/consent.ts`, which is
 * React-free so it can be unit-tested under `node --test`. If logic starts
 * accumulating here it becomes untestable in this repo — keep it out.
 *
 * Fleet posture: the first thing the mount effect does is resolve the host
 * gate. Off the vivreal.io apex `state.gated` is false, both branches below
 * render `null`, and NOTHING enters a customer site's DOM.
 *
 * SSR: initial state is inert, so the server renders nothing and the first
 * client paint matches it. The banner appears only after the mount effect
 * reads `localStorage`, which does not exist on the server — there is nothing
 * for hydration to mismatch on.
 *
 * Motion: no transitions or animations, so `prefers-reduced-motion` needs no
 * special case.
 */

const INERT: ConsentState = {
  gated: false,
  choice: null,
  gpc: false,
  showBanner: false,
  showWithdraw: false,
  vendorsAllowed: false,
};

export default function SiteConsent({ vendors = [] }: { vendors?: VendorScript[] }) {
  const [state, setState] = useState<ConsentState>(INERT);
  // A visitor who dismisses with the X has not decided; hide the banner for
  // this page view without storing anything, so the next load asks again.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Restore-on-mount. This is the D3 fix: a returning visitor who accepted
    // previously never sees the banner, so the ONLY path that can upgrade GA4
    // and inject the registry vendors for them is right here.
    setState(runConsentMount(vendors));
    // `vendors` is derived from server-rendered site config and is stable for
    // the page's lifetime; re-running this effect would re-enter the grant path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAccept = useCallback(() => setState(grantConsent(vendors)), [vendors]);
  const onReject = useCallback(() => setState(denyConsent()), []);
  const onWithdraw = useCallback(() => setState(withdrawConsent()), []);

  if (!state.gated) return null;

  if (state.showBanner) {
    if (dismissed) return null;
    return (
      <div
        className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ maxWidth: '100vw' }}
        role="region"
        aria-label="Cookie consent notification"
      >
        <div
          className="relative border shadow-lg rounded-xl p-6 w-full max-w-md mx-4 pointer-events-auto flex flex-col"
          style={{
            background: 'var(--surface, #ffffff)',
            color: 'var(--text-primary, #111111)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          }}
        >
          <button
            type="button"
            className="absolute cursor-pointer right-4 top-4 text-xl leading-none opacity-70 hover:opacity-100 focus:outline-none focus:ring-2"
            onClick={() => setDismissed(true)}
            aria-label="Close cookie consent"
          >
            &times;
          </button>
          <div className="mb-2">
            <h2 className="text-lg font-semibold leading-none tracking-tight mb-1 pr-6">
              We use cookies
            </h2>
            {/*
              Rev 2 requirement 3: the copy must match what Accept actually
              turns on. With a business-visitor identification tag in the accept
              bucket, "we analyse traffic" is no longer an accurate summary —
              the identification clause below is load-bearing, not padding, and
              must not be softened without changing what the tag does.
            */}
            <p className="text-sm" style={{ color: 'var(--text-primary, #111111)' }}>
              We use cookies and similar technologies to analyse how this site is used, to
              improve it, and for marketing. If you accept, we also use a business-visitor
              identification service that may work out who you are — your name, work email
              and employer — from your device and network, even if you never fill in a form,
              and we may contact you about Vivreal. See our{' '}
              <Link
                href="/privacy"
                className="underline"
                style={{ color: 'var(--primary, inherit)' }}
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onReject}
              className="rounded-md border px-4 py-2 text-sm cursor-pointer"
              style={{ color: 'var(--primary, inherit)' }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="rounded-md px-4 py-2 text-sm cursor-pointer"
              style={{
                background: 'var(--primary, #111111)',
                color: 'var(--text-inverse, #ffffff)',
              }}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state.showWithdraw) {
    // Withdrawal must be as easy as giving consent, and `/privacy` has to be
    // able to point at a control that exists. Rendered after the footer (this
    // component is mounted last in the layout body) rather than floating, so it
    // never covers page content.
    return (
      <div className="w-full py-3 text-center text-xs opacity-70">
        <button
          type="button"
          onClick={onWithdraw}
          className="underline cursor-pointer"
          aria-label="Cookie settings — withdraw or change your consent"
        >
          Cookie settings
        </button>
      </div>
    );
  }

  return null;
}
