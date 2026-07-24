/**
 * Structured logs for shortboard pack-band quote vs label parity.
 * Search logs for `[pack-band-telemetry]`.
 */

import {
  parseSurfboardShippingPackBandId,
  resolveSurfboardShippingPackBandId,
  type SurfboardShippingPackBandId,
} from "@/lib/surfboard-shipping-pack-bands"
import { parseSurfboardShippingTierId } from "@/lib/surfboard-shipping-tiers"

export type PackBandTelemetryDims = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

export function logPackBandQuoteTelemetry(input: {
  listingId?: string | null
  tierId?: string | null
  bandId?: string | null
  dims: PackBandTelemetryDims
  quotedUsd: number
  currency?: string
  tag?: string | null
}): void {
  const tierId = parseSurfboardShippingTierId(input.tierId)
  const bandId =
    resolveSurfboardShippingPackBandId({
      tierId,
      bandId: input.bandId,
    }) ?? parseSurfboardShippingPackBandId(input.bandId)

  console.info(
    "[pack-band-telemetry] quote",
    JSON.stringify({
      event: "quote",
      listingId: input.listingId ?? null,
      tierId,
      quoted_band: bandId,
      quoted_dims: input.dims,
      quoted_usd: input.quotedUsd,
      currency: input.currency ?? "USD",
      tag: input.tag ?? null,
    }),
  )
}

export function logPackBandLabelTelemetry(input: {
  listingId?: string | null
  orderId?: string | null
  tierId?: string | null
  bandId?: string | null
  dims: PackBandTelemetryDims
  labelCostUsd?: number | null
}): void {
  const tierId = parseSurfboardShippingTierId(input.tierId)
  const bandId =
    resolveSurfboardShippingPackBandId({
      tierId,
      bandId: input.bandId,
    }) ?? parseSurfboardShippingPackBandId(input.bandId)

  console.info(
    "[pack-band-telemetry] label",
    JSON.stringify({
      event: "label",
      listingId: input.listingId ?? null,
      orderId: input.orderId ?? null,
      tierId,
      quoted_band: bandId,
      label_dims: input.dims,
      label_cost_usd: input.labelCostUsd ?? null,
    }),
  )
}

export type { SurfboardShippingPackBandId }
