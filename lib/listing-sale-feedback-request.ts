import type { ListingSaleFeedbackBody } from "@/lib/validations/mark-listing-sold"

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const json: unknown = await res.json()
    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
    ) {
      return (json as { error: string }).error
    }
  } catch {
    // ignore
  }
  return fallback
}

export async function postListingSaleFeedback(
  listingId: string,
  input: ListingSaleFeedbackBody,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const res = await fetch(`/api/listings/${listingId}/sale-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  })

  if (res.ok) return { ok: true }
  return { ok: false, error: await readApiError(res, "Request failed"), status: res.status }
}

export async function postListingSaleTip(
  listingId: string,
  amountCents: number,
): Promise<
  | { ok: true; clientSecret: string; amountCents: number }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch(`/api/listings/${listingId}/sale-tip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amountCents }),
  })

  if (res.ok) {
    const json: unknown = await res.json().catch(() => null)
    const data =
      json && typeof json === "object" && "data" in json
        ? (json as { data?: { clientSecret?: unknown; amountCents?: unknown } }).data
        : null
    if (
      data &&
      typeof data.clientSecret === "string" &&
      typeof data.amountCents === "number"
    ) {
      return { ok: true, clientSecret: data.clientSecret, amountCents: data.amountCents }
    }
    return { ok: false, error: "Could not start tip payment", status: 500 }
  }

  return { ok: false, error: await readApiError(res, "Request failed"), status: res.status }
}
