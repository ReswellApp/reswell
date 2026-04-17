export type EndListingMode = "archive" | "delete"

export async function postEndListing(
  listingId: string,
  mode: EndListingMode,
): Promise<
  | { ok: true; mode: EndListingMode; message?: string }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch(`/api/listings/${listingId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode }),
  })

  if (res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const data =
      json &&
      typeof json === "object" &&
      "data" in json &&
      json.data &&
      typeof json.data === "object"
        ? (json.data as Record<string, unknown>)
        : null
    const m =
      data && (data.mode === "archive" || data.mode === "delete")
        ? data.mode
        : mode
    const message =
      data && typeof data.message === "string" ? data.message : undefined
    return { ok: true, mode: m, message }
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
