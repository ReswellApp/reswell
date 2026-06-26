/** Client-side helper: link a published listing to a consignment store's shop inventory. */

export async function attachListingToShopInventory(
  listingId: string,
  storeSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/consignment/store/listings/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, storeSlug }),
    })
    const json = (await res.json().catch(() => null)) as { error?: string } | null
    if (!res.ok) {
      return { ok: false, error: json?.error ?? "Couldn't add to shop inventory." }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: "Couldn't add to shop inventory." }
  }
}

export function shopInventoryPath(storeSlug: string): string {
  return `/stores/${encodeURIComponent(storeSlug)}/inventory`
}

/**
 * After a new listing is published from a store-scoped sell flow: attach to shop inventory,
 * toast on failure, then redirect to store inventory (or fallback path).
 */
export async function finishShopScopedListingPublish(args: {
  listingId: string
  storeSlug: string
  fallbackPath: string
  onError: (message: string) => void
}): Promise<string> {
  const attached = await attachListingToShopInventory(args.listingId, args.storeSlug)
  if (!attached.ok) {
    args.onError(attached.error)
    return args.fallbackPath
  }
  return shopInventoryPath(args.storeSlug)
}
