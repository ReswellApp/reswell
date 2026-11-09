import { mobileMarketplaceSalesMapSchema, type MobileMarketplaceSalesMap } from "@reswell/api-contract"

export async function fetchMarketplaceSalesMapClient(): Promise<MobileMarketplaceSalesMap> {
  const response = await fetch("/api/mobile/v1/marketplace/sales-map", {
    headers: { Accept: "application/json" },
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Unable to load the sales map"
    throw new Error(message)
  }
  if (!body || typeof body !== "object" || !("data" in body)) {
    throw new Error("Unexpected response")
  }
  return mobileMarketplaceSalesMapSchema.parse(body.data)
}
