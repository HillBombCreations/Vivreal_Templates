"use client";

import { useEffect } from "react";
import { confirmOrder } from "@/lib/confirmOrder";
import { recordPurchaseIfConfirmed, recordSiteGoal } from "@/lib/siteGoals";
import type { ClearedOrderStore } from "@/lib/confirmedOrderCart";

/**
 * Records the purchase result (owner ideas T5 and T6) once the server has
 * confirmed this order paid, once per order per tab. Renders nothing. See
 * lib/siteGoals.ts.
 */
export default function RecordPurchaseGoal() {
  useEffect(() => {
    let storage: ClearedOrderStore | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null; // blocked storage: see recordPurchaseIfConfirmed
    }
    void recordPurchaseIfConfirmed({
      search: window.location.search,
      confirm: confirmOrder,
      storage,
      record: recordSiteGoal,
    }).catch(() => undefined);
  }, []);
  return null;
}
