"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCartQuote, type CartLineItemInput } from "@/lib/utils/cartUtils";
import type { CartQuote } from "@/lib/cartQuote";

export interface RequoteResult {
  /** The new quote, or `null` when it failed (the bag then shows list prices). */
  quote: CartQuote | null;
  /** False when a newer request started meanwhile and this answer was dropped. */
  current: boolean;
}

/**
 * F4 (storefront task T2): the bag's live quote. Asks when the bag opens and
 * whenever its lines change; `requote` asks again on demand (Checkout).
 *
 * Only the newest request may set the quote, so a slow answer for an older
 * bag can never overwrite a newer one. Until the first answer the quote is
 * `null` and the bag shows today's list prices.
 */
export function useCartQuote(lines: CartLineItemInput[], linesKey: string, open: boolean) {
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const latestRequest = useRef(0);
  const linesRef = useRef(lines);
  // Declared before the asking effect, so it runs first and the ask reads
  // this render's lines.
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const requote = useCallback(async (): Promise<RequoteResult> => {
    const request = ++latestRequest.current;
    const next = await fetchCartQuote(linesRef.current);
    if (request !== latestRequest.current) return { quote: next, current: false };
    setQuote(next);
    return { quote: next, current: true };
  }, []);

  useEffect(() => {
    if (!open || !linesKey) return;
    void requote();
  }, [open, linesKey, requote]);

  return { quote, requote };
}
