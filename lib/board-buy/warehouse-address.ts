import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

function envTrim(name: string): string {
  return (process.env[name] ?? "").trim()
}

export function getBoardBuyWarehouseAddress():
  | { ok: true; address: RateQuoteAddressFields }
  | { ok: false; error: string } {
  const name = envTrim("RESWELL_BUY_SHIP_TO_NAME") || "Reswell"
  const phone = envTrim("RESWELL_BUY_SHIP_TO_PHONE")
  const line1 = envTrim("RESWELL_BUY_SHIP_TO_LINE1")
  const city = envTrim("RESWELL_BUY_SHIP_TO_CITY")
  const state = envTrim("RESWELL_BUY_SHIP_TO_STATE")
  const postal = envTrim("RESWELL_BUY_SHIP_TO_POSTAL")
  const country = envTrim("RESWELL_BUY_SHIP_TO_COUNTRY") || "US"

  if (!line1 || !city || !state || !postal) {
    return {
      ok: false,
      error:
        "Reswell warehouse address is not configured. Set RESWELL_BUY_SHIP_TO_LINE1, CITY, STATE, and POSTAL.",
    }
  }

  return {
    ok: true,
    address: {
      name,
      phone: phone || "0000000000",
      company_name: "Reswell",
      address_line1: line1,
      address_line2: envTrim("RESWELL_BUY_SHIP_TO_LINE2"),
      city_locality: city,
      state_province: state,
      postal_code: postal,
      country_code: country,
      residential: "no",
    },
  }
}
