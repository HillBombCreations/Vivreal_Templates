export async function subscribeUser(
  email: string,
  collectionId: string,
  // Optional extra subscriber attributes beyond the email (e.g. the footer
  // newsletter's { location } select). Omitted ⇒ today's email-only payload.
  fields?: Record<string, string>,
): Promise<boolean> {
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
