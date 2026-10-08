/**
 * The error sentence a site route may hand a visitor from a VR_Client_API
 * failure body, or the route's own fallback.
 *
 * VR_Client_API now follows the fleet error contract (VR_Client_API #116): a
 * masked 5xx says `errorCode: 'INTERNAL'` beside "Internal Server Error", and
 * a Joi failure says `errorCode: 'VALIDATION'` beside "Check the highlighted
 * fields." Neither sentence is for a visitor: the site's forms highlight no
 * server fields, and "Internal Server Error" never was. Before the contract a
 * Joi failure's `error` was an array, which every reader here dropped to its
 * own fallback, so this keeps a visitor seeing exactly that fallback.
 *
 * Every other refusal (a contact guard's "Please enter your name", a coupon
 * that has ended, a paused site) is a sentence written for the person typing,
 * and passes through as before.
 */
const NOT_FOR_VISITORS = new Set(['VALIDATION', 'INTERNAL']);

export function upstreamErrorForVisitor(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const { error, message, errorCode } = body as { error?: unknown; message?: unknown; errorCode?: unknown };
  if (typeof errorCode === 'string' && NOT_FOR_VISITORS.has(errorCode)) return fallback;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
