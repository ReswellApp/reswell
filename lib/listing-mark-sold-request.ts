import type { SoldOffPlatformChannel } from "@/lib/validations/mark-listing-sold"

export type MarkListingSoldInput = {
  channel?: SoldOffPlatformChannel
  detail?: string
  reswellHelpedFindBuyer?: boolean
}

export async function postMarkListingSold(
  listingId: string,
  input: MarkListingSoldInput = {},
): Promise<
  | { ok: true; priceUsd: number }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch(`/api/listings/${listingId}/mark-sold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  })

  if (res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const data =
      json && typeof json === "object" && "data" in json
        ? (json as { data?: { priceUsd?: unknown } }).data
        : null
    const priceUsd =
      data && typeof data.priceUsd === "number" && Number.isFinite(data.priceUsd)
        ? data.priceUsd
        : 0
    return { ok: true, priceUsd }
  }

  let error = "Request failed"
  try {
    const json: unknown = await res.json()
    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
    ) {
      error = (json as { error: string }).error
    }
  } catch {
    // ignore
  }

  return { ok: false, error, status: res.status }
}
