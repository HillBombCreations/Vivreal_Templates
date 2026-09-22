/**
 * The address rule for the public subscribe form, applied at the edge.
 *
 * This is the EARLIEST point on a customer site where an address can be
 * refused: `/api/subscribe` is the one server route every email-capture
 * surface funnels through (hero inline, footer newsletter, exit-intent popup),
 * and it runs before the upstream call is made at all.
 *
 * It lives here rather than inside the route because the route imports
 * `next/server`, which the test runner cannot load. Same reason
 * `leadAttribution.ts` exists: the rule is testable, the route is a thin call
 * site.
 *
 * ONE RULE, TWO REPOSITORIES, ON PURPOSE. VR_Client_API's
 * `src/shared/contactGuards.js` carries the identical rule as `EMAIL_SHAPE`,
 * because that is the write boundary every capture surface reaches, including
 * ones that never touch this route (the MCP `submit_contact_form` tool, a
 * direct API-key call). A Node CommonJS Lambda and a Next.js app share no
 * package, so the constant is duplicated; both suites pin the same production
 * payloads and the same legitimate addresses, so a drift between them shows up
 * as a red test rather than as an address one side accepts and the other
 * silently drops.
 */

/**
 * WHAT THIS REFUSES, AND WHY THE OLD RULE DID NOT.
 *
 * The previous rule here was `/\S+@\S+\.\S+/` and it was not anchored, so it
 * asked only whether an address-shaped substring appeared ANYWHERE in the
 * value. `"drop table users foo@bar.com"` passed. So did all ten of the
 * scanner payloads a read-only production probe read back out of a live
 * subscriber list on 2026-09-22, stored on 2026-08-02: a real-looking mailbox
 * with a SQL time-delay string glued to the end of it.
 *
 * The rule now reads the two halves of an address by their own rules:
 *
 *   LOCAL PART (left of the at sign) is RFC 5322 `atext` plus unicode letters
 *   and digits for SMTPUTF8 mailboxes, dot separated, no leading, trailing or
 *   doubled dot, 64 characters at most. AN APOSTROPHE IS LEGAL HERE and stays
 *   legal: `o'brien@example.com` is a surname, not an injection.
 *
 *   DOMAIN (right of the at sign) is hostname labels only: unicode letters and
 *   digits plus internal hyphens, at least two labels, and a top level domain
 *   of two or more characters starting with a letter, so `.photography`,
 *   `.international` and punycode `.xn--p1ai` all pass. Every one of the ten
 *   payloads put its junk here, and a hostname label has no room for a quote,
 *   a bracket, a semicolon, a pipe or a percent sign.
 *
 * A syntax rule, NOT a payload blocklist: blocklisting a quote or a double
 * hyphen would refuse every O'Brien and every punycode domain while a payload
 * carrying neither walked straight through.
 *
 * Deliberately refused, all legal per RFC and none of them a customer: quoted
 * local parts (`"jo smith"@example.com`, which re-admits the space and the
 * quote), address-literal domains (`jo@[192.168.0.1]`), underscores in a
 * hostname label, and emoji.
 */
export const EMAIL_SHAPE =
  /^(?=[^@]{1,64}@)[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(?:\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[\p{L}][\p{L}\p{N}-]{0,61}[\p{L}\p{N}]$/u;

/** Longest address we will forward. Well above any real one (RFC caps at 254). */
export const MAX_EMAIL_LENGTH = 254;

/**
 * True when `value` is a string we are willing to store as somebody's address.
 *
 * Length is checked BEFORE the shape so an enormous body cannot be handed to
 * the regex. The regex itself is linear (label characters exclude the dot that
 * separates them, so each label's extent is forced by the next separator), but
 * a cap costs nothing and removes the question.
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_SHAPE.test(trimmed);
}
