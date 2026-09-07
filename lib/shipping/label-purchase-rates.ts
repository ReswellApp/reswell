import { formatCarrierDisplayName } from "@/lib/shipping/resolve-carrier-code"

export const LABEL_PURCHASE_RATE_LIMIT = 4

export type LabelPurchaseRate = {
  rate_id: string
  carrierLabel: string
  serviceName: string
  amount: number
  currency: string
  carrierCode?: string | null
  serviceCode?: string | null
}

type CarrierFamily = "usps" | "ups" | "fedex"
type ServiceFamily = "ground" | "priority" | "media"

function blob(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase()
}

function carrierFamily(
  carrierCode: string | null | undefined,
  carrierLabel: string,
): CarrierFamily | null {
  const text = blob(carrierCode, carrierLabel)
  if (!text || text.includes("globalpost")) return null
  if (text.includes("usps") || text.includes("stamps") || text.includes("postal")) return "usps"
  if (text.includes("ups")) return "ups"
  if (text.includes("fedex") || text.includes("fed ex")) return "fedex"
  return null
}

function serviceFamily(
  serviceCode: string | null | undefined,
  serviceName: string,
): ServiceFamily | null {
  const text = blob(serviceCode, serviceName)
  if (!text) return null
  if (text.includes("media_mail") || text.includes("media mail")) return "media"
  if (
    text.includes("express") ||
    text.includes("overnight") ||
    text.includes("next day") ||
    text.includes("2nd day") ||
    text.includes("2 day") ||
    text.includes("2day") ||
    text.includes("3 day") ||
    text.includes("3day")
  ) {
    return null
  }
  if (text.includes("priority")) return "priority"
  if (
    text.includes("ground") ||
    text.includes("parcel_select") ||
    text.includes("parcel select") ||
    text.includes("home_delivery") ||
    text.includes("home delivery")
  ) {
    return "ground"
  }
  return null
}

function allowsMediaMail(listingSection: string | null | undefined): boolean {
  return listingSection === "magazines"
}

/**
 * Label-purchase picker: USPS / UPS / FedEx Ground and Priority only,
 * Media Mail only for magazines, cheapest unique option per carrier+service, top 4.
 */
export function curateLabelPurchaseRates<T extends LabelPurchaseRate>(
  rates: T[],
  listingSection?: string | null,
): T[] {
  const allowMedia = allowsMediaMail(listingSection)
  const cheapestByFamily = new Map<string, T>()

  for (const rate of rates) {
    if (!(rate.amount > 0) || !rate.rate_id) continue
    const carrier = carrierFamily(rate.carrierCode, rate.carrierLabel)
    if (!carrier) continue
    const service = serviceFamily(rate.serviceCode, rate.serviceName)
    if (!service) continue
    if (service === "media" && !allowMedia) continue

    const key = `${carrier}:${service}`
    const existing = cheapestByFamily.get(key)
    if (!existing || rate.amount < existing.amount) {
      cheapestByFamily.set(key, {
        ...rate,
        carrierLabel: formatCarrierDisplayName(rate.carrierLabel, rate.carrierCode ?? carrier),
      })
    }
  }

  return [...cheapestByFamily.values()]
    .sort((a, b) => a.amount - b.amount)
    .slice(0, LABEL_PURCHASE_RATE_LIMIT)
}
