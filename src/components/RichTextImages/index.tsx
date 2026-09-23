'use client';

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { RichTextImageProvider } from '@hillbombcreations/site-renderer';

/**
 * H177 - mounts the renderer's inline rich-text image resolver for one page.
 *
 * WHY A TEMPLATES COMPONENT RATHER THAN THE RENDERER'S PROVIDER DIRECTLY
 * ---------------------------------------------------------------------
 * `RichTextImageProvider` is a `'use client'` component whose only prop is a
 * FUNCTION (`resolve`). Every place this needs to be mounted in Templates is a
 * server component, and a function cannot cross the server-to-client boundary:
 * passing one is a serialization error, not a subtle bug. So the thing that
 * crosses is the MAP, which is plain JSON, and the closure that reads it is
 * built here, on the client side of the boundary.
 *
 * That is also why the Studio preview did not need this shim and Templates
 * does. The preview shell is itself a client component, so it can hand the
 * renderer a closure directly.
 *
 * WHY THE RESOLVER IS MEMOISED
 * ----------------------------
 * The provider publishes `resolve` AS the context value. A fresh function
 * identity on every render would change the context value on every render and
 * re-render every `RichText` on the page for no reason. `useCallback` keyed on
 * the map keeps the identity stable for as long as the data is.
 *
 * FAIL-CLOSED IS PRESERVED
 * ------------------------
 * A key absent from the map resolves to `undefined`, which is exactly what the
 * renderer's default no-op resolver returns. The image then reaches the
 * sanitiser with no `src` and is dropped. Mounting this widens what CAN render;
 * it never makes an unresolved key render as something else, and it never
 * loosens the sanitiser's media-host allowlist, because the URLs are signed
 * upstream against that same host.
 */
export default function RichTextImages({
  map,
  children,
}: {
  /** Key to signed media URL. Merged upstream from every read on the page. */
  map: Record<string, string>;
  children: ReactNode;
}) {
  const resolve = useCallback((key: string) => map[key], [map]);
  return <RichTextImageProvider resolve={resolve}>{children}</RichTextImageProvider>;
}
