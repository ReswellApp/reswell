export type EndListingMode = "delete" | "archive"

export async function postEndListing(
  listingId: string,
  mode: "delete" = "delete",
): Promise<{ ok: true; mode: EndListingMode } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/listings/${listingId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode }),
  })

  if (res.ok) {
    let resolved: EndListingMode = "delete"
    try {
      const json: unknown = await res.json()
      if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        json.data &&
        typeof json.data === "object" &&
        "mode" in json.data &&
        (json.data as { mode?: unknown }).mode === "archive"
      ) {
        resolved = "archive"
      }
    } catch {
      // success without a body still means the listing is gone
    }
    return { ok: true, mode: resolved }
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
