/** Client helper for sell flows. The server re-checks membership before a save. */
export async function fetchActingShopAccountId(): Promise<string | null> {
  try {
    const response = await fetch("/api/account/acting-shop", {
      credentials: "include",
      cache: "no-store",
    })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (!body || typeof body !== "object") return null
    const accountId = (body as { accountId?: unknown }).accountId
    return typeof accountId === "string" && accountId.trim() ? accountId : null
  } catch {
    return null
  }
}
