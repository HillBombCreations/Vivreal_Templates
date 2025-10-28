export async function subscribeUser(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.success);
  } catch (err) {
    console.error("[subscribeUser] Error:", err);
    return false;
  }
}
