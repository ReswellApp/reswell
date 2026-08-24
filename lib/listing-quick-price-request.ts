export async function patchListingQuickPrice(
  listingId: string,
  priceUsd: number,
  options?: { showPriceMarkdown?: boolean },
): Promise<{ ok: true; priceUsd: number } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/price`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      priceUsd,
      ...(options?.showPriceMarkdown != null
        ? { showPriceMarkdown: options.showPriceMarkdown }
        : {}),
    }),
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
    const n =
      data && typeof data.priceUsd === "number" && Number.isFinite(data.priceUsd)
        ? data.priceUsd
        : priceUsd
    return { ok: true, priceUsd: n }
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
