export type EndListingMode = "delete"

export async function postEndListing(
  listingId: string,
  mode: EndListingMode = "delete",
): Promise<{ ok: true; mode: EndListingMode } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/listings/${listingId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode }),
  })

  if (res.ok) {
    return { ok: true, mode: "delete" }
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
