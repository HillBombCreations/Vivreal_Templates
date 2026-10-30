"use client";

import { useEffect } from "react";
import { PREVIEW_NONCE_PARAM, isPreviewNonce, newPreviewNonce, previewLinkTarget } from "@/lib/previewGuard";

/**
 * Draft mode only (mounted by the root layout when `draftMode()` is on): a
 * click on an internal link carries this preview's nonce, so moving around a
 * preview never lands on a public edge copy (owner ideas T12, D48, layer b).
 * Listens in the capture phase, before the router's own link handler, and
 * navigates with a full load. Renders nothing. See lib/previewGuard.ts.
 */
export default function PreviewLinkNonce() {
  useEffect(() => {
    const current = new URL(window.location.href).searchParams.get(PREVIEW_NONCE_PARAM);
    const nonce = isPreviewNonce(current) ? current : newPreviewNonce();
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self")) return;
      const next = previewLinkTarget(anchor.getAttribute("href") ?? "", window.location.href, nonce);
      if (!next) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(next);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
