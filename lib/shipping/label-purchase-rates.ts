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
type StandardServiceFamily = "ground" | "priority" | "media"
type ExpeditedServiceFamily = "same-day" | "next-day"

export type LabelPurchaseRateOptions = {
  includeSameAndNextDay?: boolean
  /**
   * Admin tools: keep every distinct USPS / UPS / FedEx service (cheapest quote
   * per carrier + service), including air — Ground, Priority, 2nd Day, Next Day,
   * Overnight, etc. Skips the standard Ground/Priority top-N filter.
   */
  includeAllDistinctServices?: boolean
}

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

function expeditedServiceFamily(
  serviceCode: string | null | undefined,
  serviceName: string,
): ExpeditedServiceFamily | null {
  const text = blob(serviceCode, serviceName)
  if (
    text.includes("same_day") ||
    text.includes("same day") ||
    text.includes("sameday")
  ) {
    return "same-day"
  }
  if (
    text.includes("next_day") ||
    text.includes("next day") ||
    text.includes("nextday") ||
    text.includes("overnight")
  ) {
    return "next-day"
  }
  return null
}

function standardServiceFamily(
  serviceCode: string | null | undefined,
  serviceName: string,
): StandardServiceFamily | null {
  const text = blob(serviceCode, serviceName)
  if (!text) return null
  if (text.includes("media_mail") || text.includes("media mail")) return "media"
  if (
    text.includes("express") ||
    expeditedServiceFamily(serviceCode, serviceName) != null ||
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

function withDisplayCarrierLabel<T extends LabelPurchaseRate>(
  rate: T,
  carrier: CarrierFamily,
): T {
  return {
    ...rate,
    carrierLabel: formatCarrierDisplayName(rate.carrierLabel, rate.carrierCode ?? carrier),
  }
}

/**
 * Label-purchase picker: USPS / UPS / FedEx Ground and Priority only,
 * Media Mail only for magazines, cheapest unique option per carrier+service, top 4.
 * Admin flows may additionally retain every distinct same-day and next-day service,
 * or every distinct service when {@link LabelPurchaseRateOptions.includeAllDistinctServices}
 * is set.
 */
export function curateLabelPurchaseRates<T extends LabelPurchaseRate>(
  rates: T[],
  listingSection?: string | null,
  options: LabelPurchaseRateOptions = {},
): T[] {
  const allowMedia = allowsMediaMail(listingSection)

  if (options.includeAllDistinctServices) {
    const cheapestByService = new Map<string, T>()
    for (const rate of rates) {
      if (!(rate.amount > 0) || !rate.rate_id) continue
      const carrier = carrierFamily(rate.carrierCode, rate.carrierLabel)
      if (!carrier) continue
      const serviceIdentity = blob(rate.serviceCode, rate.serviceName)
      if (!serviceIdentity) continue
      if (
        (serviceIdentity.includes("media_mail") || serviceIdentity.includes("media mail")) &&
        !allowMedia
      ) {
        continue
      }
      const key = `${carrier}:${serviceIdentity}`
      const existing = cheapestByService.get(key)
      if (!existing || rate.amount < existing.amount) {
        cheapestByService.set(key, withDisplayCarrierLabel(rate, carrier))
      }
    }
    return [...cheapestByService.values()].sort((a, b) => a.amount - b.amount)
  }

  const cheapestStandardByFamily = new Map<string, T>()
  const cheapestExpeditedByService = new Map<string, T>()

  for (const rate of rates) {
    if (!(rate.amount > 0) || !rate.rate_id) continue
    const carrier = carrierFamily(rate.carrierCode, rate.carrierLabel)
    if (!carrier) continue
    const expedited = expeditedServiceFamily(rate.serviceCode, rate.serviceName)
    if (options.includeSameAndNextDay && expedited) {
      const serviceIdentity = blob(rate.serviceCode, rate.serviceName)
      const key = `${carrier}:${expedited}:${serviceIdentity}`
      const existing = cheapestExpeditedByService.get(key)
      if (!existing || rate.amount < existing.amount) {
        cheapestExpeditedByService.set(key, withDisplayCarrierLabel(rate, carrier))
      }
      continue
    }

    const service = standardServiceFamily(rate.serviceCode, rate.serviceName)
    if (!service) continue
    if (service === "media" && !allowMedia) continue

    const key = `${carrier}:${service}`
    const existing = cheapestStandardByFamily.get(key)
    if (!existing || rate.amount < existing.amount) {
      cheapestStandardByFamily.set(key, withDisplayCarrierLabel(rate, carrier))
    }
  }

  const standardRates = [...cheapestStandardByFamily.values()]
    .sort((a, b) => a.amount - b.amount)
    .slice(0, LABEL_PURCHASE_RATE_LIMIT)
  const expeditedRates = [...cheapestExpeditedByService.values()].sort(
    (a, b) => a.amount - b.amount,
  )

  return [...standardRates, ...expeditedRates]
}
