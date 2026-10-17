import type { GoogleMerchantProductInputPayload } from "@/lib/google-merchant/map-listing-to-product-input"

const TSV_HEADERS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "availability",
  "price",
  "brand",
  "mpn",
  "identifier_exists",
  "condition",
  "google_product_category",
  "custom_label_0",
  "custom_label_1",
  "custom_label_2",
  "shipping",
] as const

function escapeTsvField(value: string): string {
  if (/["\t\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function microsToUsd(amountMicros: string): string {
  const micros = Number(amountMicros)
  if (!Number.isFinite(micros)) return ""
  return `${(micros / 1_000_000).toFixed(2)} USD`
}

function shippingColumn(
  shipping: GoogleMerchantProductInputPayload["productAttributes"]["shipping"],
): string {
  if (!shipping || shipping.length === 0) return ""
  return shipping
    .map((row) => {
      const price = microsToUsd(row.price.amountMicros)
      return `${row.country}::${row.service}:${price}`
    })
    .join(",")
}

function rowValues(item: GoogleMerchantProductInputPayload): string[] {
  const attrs = item.productAttributes
  return [
    item.offerId,
    attrs.title,
    attrs.description,
    attrs.link,
    attrs.imageLink,
    attrs.additionalImageLinks?.join(",") ?? "",
    attrs.availability === "IN_STOCK" ? "in_stock" : "out_of_stock",
    microsToUsd(attrs.price.amountMicros),
    attrs.brand ?? "",
    attrs.mpn ?? "",
    attrs.identifierExists ? "yes" : "no",
    attrs.condition.toLowerCase(),
    attrs.googleProductCategory,
    attrs.customLabel0 ?? "",
    attrs.customLabel1 ?? "",
    attrs.customLabel2 ?? "",
    shippingColumn(attrs.shipping),
  ]
}

/** Tab-separated product feed Google Merchant Center can fetch on a schedule. */
export function googleMerchantProductInputsToTsv(
  items: GoogleMerchantProductInputPayload[],
): string {
  const lines = [TSV_HEADERS.join("\t")]
  for (const item of items) {
    lines.push(rowValues(item).map(escapeTsvField).join("\t"))
  }
  return `${lines.join("\n")}\n`
}
