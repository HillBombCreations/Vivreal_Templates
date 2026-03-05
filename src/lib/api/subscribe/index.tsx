import "server-only";

const API_URL = process.env.CLIENT_API!;
const CMS_API_KEY = process.env.API_KEY!;

export async function subscribeUser(email: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/tenant/definedCollectionObject`, {
      method: "POST",
      headers: {
        Authorization: CMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        type: "subscribeUser",
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[subscribeUserOnCMS] CMS error:", res.status, res.statusText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[subscribeUserOnCMS] Exception:", err);
    return false;
  }
}
