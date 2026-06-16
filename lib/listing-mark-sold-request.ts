import type { SoldOffPlatformChannel } from "@/lib/validations/mark-listing-sold"

export type MarkListingSoldInput = {
  channel: SoldOffPlatformChannel
  detail?: string
}

export async function postMarkListingSold(
  listingId: string,
  input: MarkListingSoldInput,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/listings/${listingId}/mark-sold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  })

  if (res.ok) {
    return { ok: true }
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
