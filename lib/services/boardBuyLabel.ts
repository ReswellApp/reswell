import { BOARD_BUY_DEFAULT_PARCEL } from "@/lib/board-buy/constants"
import { getBoardBuyWarehouseAddress } from "@/lib/board-buy/warehouse-address"
import { updateBoardBuySubmission } from "@/lib/db/boardBuy"
import {
  fetchShipEngineRatesForSurfboard,
  purchaseShipEngineLabel,
} from "@/lib/shipengine/surfboard-label"
import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { BoardBuySubmission } from "@/lib/types/board-buy"

function shipFromAddress(sub: BoardBuySubmission): RateQuoteAddressFields {
  return {
    name: sub.shipFromName,
    phone: sub.shipFromPhone,
    company_name: "",
    address_line1: sub.shipFromLine1,
    address_line2: sub.shipFromLine2 ?? "",
    city_locality: sub.shipFromCity,
    state_province: sub.shipFromState,
    postal_code: sub.shipFromPostal,
    country_code: sub.shipFromCountry || "US",
    residential: "yes",
  }
}

function parcelFromSubmission(sub: BoardBuySubmission) {
  return {
    lengthIn: sub.parcelLengthIn ?? BOARD_BUY_DEFAULT_PARCEL.lengthIn,
    widthIn: sub.parcelWidthIn ?? BOARD_BUY_DEFAULT_PARCEL.widthIn,
    heightIn: sub.parcelHeightIn ?? BOARD_BUY_DEFAULT_PARCEL.heightIn,
    weightLb: sub.parcelWeightLb ?? BOARD_BUY_DEFAULT_PARCEL.weightLb,
  }
}

export async function purchaseBoardBuyInboundLabel(
  submission: BoardBuySubmission,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (submission.status !== "accepted" && submission.status !== "label_ready") {
    return { ok: false, error: "Accept the offer before purchasing a label." }
  }
  if (submission.labelPdfUrl) {
    return { ok: true }
  }

  const warehouse = getBoardBuyWarehouseAddress()
  if (!warehouse.ok) {
    return warehouse
  }

  const rates = await fetchShipEngineRatesForSurfboard({
    shipFrom: shipFromAddress(submission),
    shipTo: warehouse.address,
    parcel: parcelFromSubmission(submission),
    tierId: "shortboard",
  })
  if (!rates.ok) {
    return { ok: false, error: rates.error }
  }
  const cheapest = [...rates.rates].sort((a, b) => a.amount - b.amount)[0]
  if (!cheapest) {
    return { ok: false, error: "No carrier rates for this shipment." }
  }

  const purchased = await purchaseShipEngineLabel(cheapest.rate_id)
  if (!purchased.ok) {
    return { ok: false, error: purchased.error }
  }

  const label = purchased.result
  const supabase = createServiceRoleClient()
  await updateBoardBuySubmission(supabase, submission.id, {
    status: "label_ready",
    label_pdf_url: label.labelUrl,
    tracking_number: label.trackingNumber,
    tracking_carrier: label.trackingCarrier,
  })

  return { ok: true }
}
