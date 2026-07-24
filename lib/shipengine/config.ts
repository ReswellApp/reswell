/**
 * ShipEngine REST API — labels, rates, carriers.
 * https://www.shipengine.com/docs/auth/
 */
export function getShipEngineApiBase(): string {
  return (
    process.env.SHIPENGINE_API_BASE?.trim() || "https://api.shipengine.com/v1"
  )
}

/** JWKS for verifying outbound webhooks (RSA-SHA256). */
export function getShipEngineJwksUrl(): string {
  const base = process.env.SHIPENGINE_API_BASE?.trim().toLowerCase() || ""
  if (base.includes("api.eu.shipengine.com")) {
    return "https://api.eu.shipengine.com/jwks"
  }
  return "https://api.shipengine.com/jwks"
}

export function isShipEngineConfigured(): boolean {
  const key = process.env.SHIPENGINE_API_KEY?.trim()
  return Boolean(key && key.length > 0)
}

/** Label branding image uploaded in ShipEngine dashboard (Features → Label branding). */
export function getShipEngineLabelImageId(): string | null {
  const id = process.env.SHIPENGINE_LABEL_IMAGE_ID?.trim()
  return id && id.length > 0 ? id : null
}

import {
  RESWELL_UPS_CARRIER_ID_DEFAULT,
  isReswellUpsCarrierId,
} from "@/lib/shipengine/reswell-carriers"

/** Reswell UPS carrier in ShipEngine; optional env override for non-default accounts. */
export function getReswellUpsCarrierId(): string {
  const id = process.env.SHIPENGINE_RESWELL_UPS_CARRIER_ID?.trim()
  return id && id.length > 0 ? id : RESWELL_UPS_CARRIER_ID_DEFAULT
}
