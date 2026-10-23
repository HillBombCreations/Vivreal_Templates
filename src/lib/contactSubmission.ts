/**
 * How `/api/contact` reads a form submission before forwarding it to
 * VR_Client_API: which kind of form sent it, which required fields are
 * missing, and what `message` to send.
 *
 * WHY THIS EXISTS (vivreal-hq research-admin-inbound-2026-10-21.md, item 3).
 * The renderer's `buildSubmitPayload` fills `message` from the FIRST textarea
 * of a form. vivreal.io /migrate has no field keyed `message`; its only
 * textarea is the OPTIONAL notes box. So a migration request with blank notes
 * arrived with `message: ""`, passed the form's own check, and was refused
 * here as "Missing required fields": nothing stored, nothing emailed.
 *
 * The fix is here, not in the renderer, because this route is the boundary
 * that turns a form payload into VR_Client_API's contract
 * (`sendContactEmailValidator`, `message: Joi.string().required()`, which
 * refuses ""), and because a renderer change reaches every live site. A
 * migration request is told apart by a non-empty `customFields.siteUrl`, the
 * same rule the research documents for the stored rows. A plain contact
 * message keeps its strict check: no message, no forward.
 *
 * Dependency-free on purpose, so it runs under `node --test`.
 */
import { isVivrealOwnSite } from './vivrealApex.ts';

export type ContactFormType = 'contact' | 'migration';

/**
 * Sent as `message` when a migration request has no notes. Fixed text, never
 * built from what the visitor typed: `siteUrl` already travels in
 * `customFields`, which is stored and shown in the email.
 */
export const MIGRATION_NO_NOTES_MESSAGE = 'No notes were added.';

/** The stored marker the admin inbound page reads (`objectValue.formType`). */
export const CONTACT_FORM_TYPE_KEY = 'formType';

/** VR_Client_API `sendContactEmailValidator`: `customFields ... .max(40)`. */
const CUSTOM_FIELDS_MAX_KEYS = 40;

/** The required payload keys, the only names a rejection capture may carry. */
export type RequiredContactField = 'name' | 'customerEmail' | 'message';

export interface ContactFields {
  name?: unknown;
  customerEmail?: unknown;
  message?: unknown;
}

/** Absent, non-string, or whitespace only. */
export function isBlankText(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `migration` when the submission carries a non-empty `siteUrl`, else `contact`. */
export function classifyContactForm(customFields: unknown): ContactFormType {
  if (!isPlainObject(customFields)) return 'contact';
  return isBlankText(customFields.siteUrl) ? 'contact' : 'migration';
}

/**
 * The required fields this submission is missing, by NAME only. A migration
 * request may leave `message` blank; a contact message may not.
 */
export function missingRequiredContactFields(
  fields: ContactFields,
  formType: ContactFormType,
): RequiredContactField[] {
  const missing: RequiredContactField[] = [];
  if (isBlankText(fields.name)) missing.push('name');
  if (isBlankText(fields.customerEmail)) missing.push('customerEmail');
  if (formType === 'contact' && isBlankText(fields.message)) missing.push('message');
  return missing;
}

/**
 * The `message` to forward. Call only after `missingRequiredContactFields`
 * came back empty: then a blank message can only be a migration's.
 */
export function messageToForward(message: unknown): string {
  return typeof message === 'string' && message.trim() !== '' ? message : MIGRATION_NO_NOTES_MESSAGE;
}

/**
 * Add `formType` to the forwarded `customFields`, on Vivreal's own sites ONLY.
 * VR_Client_API spreads `customFields` into the stored `objectValue`
 * (`strict: false`), so this needs no schema change. Customer sites get their
 * payload back unchanged: the marker exists for Vivreal's admin page, and a
 * customer's stored rows and lead emails should not grow a field they never
 * asked for.
 *
 * The server's value wins over a submitted field of the same name, since a
 * label a visitor can set is no label. When the payload is already at
 * VR_Client_API's 40-key cap the marker is skipped: a lost label is better
 * than a refused lead.
 */
export function withFormTypeMarker(
  customFields: Record<string, unknown> | undefined,
  formType: ContactFormType,
  siteId: string | undefined,
): Record<string, unknown> | undefined {
  if (!isVivrealOwnSite(siteId)) return customFields;
  if (customFields !== undefined && !isPlainObject(customFields)) return customFields;
  const base = customFields ?? {};
  const adds = !Object.prototype.hasOwnProperty.call(base, CONTACT_FORM_TYPE_KEY);
  if (adds && Object.keys(base).length >= CUSTOM_FIELDS_MAX_KEYS) return customFields;
  return { ...base, [CONTACT_FORM_TYPE_KEY]: formType };
}
