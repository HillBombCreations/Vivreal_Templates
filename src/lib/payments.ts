/**
 * Payments-provider membership for the checkout wire.
 *
 * The cart POSTs `products[] = [{ price, quantity, name }]` to `/api/checkout`
 * and VR_Client_API resolves the payments provider SERVER-SIDE from the
 * group's single active payments integration — so the Templates only need to
 * know *which* integration types count as a payments provider (cart wiring,
 * provider-scoped product fetches), never which one handles the charge.
 *
 * Keep this set in lock-step with VR_Secure_API's `PAYMENTS_PROVIDER_TYPES`
 * (`updateIntegrations.js:28`) — the D4 payments-mutex set. This is
 * deliberately a local mirror (same pattern as the renderer's `poweredBy.ts`
 * local tier set): a second private package dependency is not an option, and
 * Templates cannot import backend code.
 *
 * Shopify is EXCLUDED on purpose — its checkout is a hosted-redirect fork
 * (Phase 5) and it is not in the backend mutex set.
 */
export const PAYMENTS_PROVIDER_TYPES: ReadonlySet<string> = new Set([
  "stripe",
  "square",
]);

/**
 * Case-insensitive membership check against {@link PAYMENTS_PROVIDER_TYPES}.
 * Trims + lowercases before testing; empty/undefined/null -> false.
 */
export function isPaymentsProvider(type: string | undefined | null): boolean {
  if (!type) return false;
  return PAYMENTS_PROVIDER_TYPES.has(type.trim().toLowerCase());
}
