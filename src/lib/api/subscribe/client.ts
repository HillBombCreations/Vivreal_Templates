export async function subscribeUser(
  email: string,
  collectionId: string,
  // Optional extra subscriber attributes beyond the email (e.g. the footer
  // newsletter's { location } select). Omitted ⇒ today's email-only payload.
  fields?: Record<string, string>,
): Promise<boolean> {
  // N-C6: no list means nowhere to sign up. Refuse here, before any request,
  // rather than post `collectionId: ''` for /api/subscribe to 400. Every form
  // that reaches this already shows SIGNUP_UNAVAILABLE_TEXT where Templates
  // owns its copy (see src/lib/subscribe/subscribersList.ts).
  if (!collectionId) return false;
  try {
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, collectionId, ...(fields ? { fields } : {}) }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.success);
  } catch (err) {
    console.error("[subscribeUser] Error:", err);
    return false;
  }
}
