'use client';

/**
 * A top progress bar for route transitions.
 *
 * The owner, three separate times: "when i click a link or tab in nav if it
 * takes a bit to load there's no real indication on the site except for the
 * browser tab loading indicator". Every page in this app is `force-dynamic`,
 * so a navigation waits on a server render before anything visibly changes —
 * on a slow request the site looks frozen and people click again.
 *
 * WHY A DOCUMENT-LEVEL CLICK LISTENER rather than `useLinkStatus`:
 * `useLinkStatus` only reports for the `<Link>` it is rendered inside, so
 * covering the site would mean threading an indicator through the renderer's
 * Navbar, the footer, every card layout and every CTA — and any link added
 * later would silently go back to feeling frozen. A capture-phase listener on
 * the document covers every same-origin navigation there is, including ones
 * this component knows nothing about.
 *
 * WHY NOT `loading.tsx`: App Router swaps the page slot for it, so the content
 * the visitor is reading VANISHES the moment they click and is replaced by a
 * skeleton. That is a bigger visual event than the one being fixed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** Never show the bar for a navigation that resolves faster than this — a
 *  flash on a 40ms transition reads as a glitch, not as feedback. */
const SHOW_AFTER_MS = 140;
/** Where the bar creeps to while waiting. It must never reach 100% on its own:
 *  a bar that completes while the page is still loading is a lie. */
const CREEP_CEILING = 0.9;

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  const clearTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (creepTimer.current) clearInterval(creepTimer.current);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    showTimer.current = null;
    creepTimer.current = null;
    doneTimer.current = null;
  }, []);

  const start = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    clearTimers();
    showTimer.current = setTimeout(() => {
      setProgress(0.08);
      setVisible(true);
      // Decelerating creep: fast at first so it feels responsive, then slower
      // and slower so a long wait still looks like progress rather than a
      // stalled bar sitting at one width.
      creepTimer.current = setInterval(() => {
        setProgress((p) => p + (CREEP_CEILING - p) * 0.12);
      }, 220);
    }, SHOW_AFTER_MS);
  }, [clearTimers]);

  const finish = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    clearTimers();
    setProgress(1);
    // Let the fill animate to full before fading, so the bar visibly COMPLETES
    // instead of disappearing mid-travel.
    doneTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);
  }, [clearTimers]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Anything the browser will not treat as a same-tab navigation: a
      // modified click opens a tab, and a handled click may do something else
      // entirely.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      if (anchor.hasAttribute('download') || (anchor.getAttribute('target') || '') === '_blank') return;

      const raw = anchor.getAttribute('href');
      if (!raw || raw.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      } catch {
        return;
      }
      // Cross-origin leaves the app; the browser shows its own indicator.
      if (url.origin !== window.location.origin) return;
      // Same page, or a pure hash jump: nothing loads, so nothing to report.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    };

    // Capture phase: React's own handlers (and `router.push`) may run first and
    // would otherwise swallow the event before it reaches the document.
    document.addEventListener('click', onClick, true);
    // Back/forward is a navigation too, and it can be just as slow.
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', start);
    };
  }, [start]);

  // Arrival. Keyed on the resolved route, which is the only honest signal that
  // the new page actually rendered.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => clearTimers, [clearTimers]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2147483000,
        pointerEvents: 'none',
        background: 'transparent',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(progress, 1) * 100}%`,
          background: 'var(--primary, #0047C7)',
          boxShadow: '0 0 8px color-mix(in srgb, var(--primary, #0047C7) 60%, transparent)',
          transition: 'width .22s ease-out, opacity .22s ease-out',
          opacity: progress >= 1 ? 0 : 1,
        }}
      />
    </div>
  );
}
