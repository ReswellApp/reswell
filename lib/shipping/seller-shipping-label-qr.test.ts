import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  paperlessQrRowHasImage,
  pickLatestPaperlessQrByOrderId,
  sellerOpenShipmentLabelStatus,
  sellerShippingLabelQrHref,
} from "./seller-shipping-label-qr.ts"

const ORDER_A = "11111111-1111-4111-8111-111111111111"
const ORDER_B = "22222222-2222-4222-8222-222222222222"

describe("seller shipping label QR", () => {
  it("builds the authenticated QR href and encodes label id", () => {
    assert.equal(
      sellerShippingLabelQrHref({ orderId: ORDER_A }),
      `/api/orders/${ORDER_A}/shipping-label/qr`,
    )
    assert.equal(
      sellerShippingLabelQrHref({
        orderId: ORDER_A,
        labelId: "label 1",
        downloadApiPrefix: "/api/admin/orders/",
      }),
      `/api/admin/orders/${ORDER_A}/shipping-label/qr?label_id=label%201`,
    )
  })

  it("treats blank QR fields as missing", () => {
    assert.equal(paperlessQrRowHasImage({ paperless_qr_url: "  ", paperless_qr_storage_path: null }), false)
    assert.equal(
      paperlessQrRowHasImage({
        paperless_qr_url: null,
        paperless_qr_storage_path: "orders/a/qr.png",
      }),
      true,
    )
  })

  it("keeps the newest paperless QR per order and skips rows without an image", () => {
    const map = pickLatestPaperlessQrByOrderId([
      {
        order_id: ORDER_A,
        created_at: "2026-10-01T00:00:00.000Z",
        paperless_qr_storage_path: "old.png",
        paperless_handoff_code: "OLDCODE",
        paperless_instructions: "old",
      },
      {
        order_id: ORDER_A,
        created_at: "2026-10-20T00:00:00.000Z",
        paperless_qr_url: "https://example.com/qr.png",
        paperless_handoff_code: "NEWCODE",
        paperless_instructions: "Show at USPS",
      },
      {
        order_id: ORDER_B,
        created_at: "2026-10-21T00:00:00.000Z",
        paperless_qr_url: "  ",
        paperless_instructions: "ignored",
      },
    ])

    assert.equal(map.size, 1)
    assert.deepEqual(map.get(ORDER_A), {
      paperlessInstructions: "Show at USPS",
      paperlessHandoffCode: "NEWCODE",
    })
  })

  it("lets a later equal-timestamp row win so admin replacements overlay marketplace labels", () => {
    const map = pickLatestPaperlessQrByOrderId([
      {
        order_id: ORDER_A,
        created_at: "2026-10-20T00:00:00.000Z",
        paperless_qr_storage_path: "market.png",
        paperless_handoff_code: "MKT",
      },
      {
        order_id: ORDER_A,
        created_at: "2026-10-20T00:00:00.000Z",
        paperless_qr_storage_path: "admin.png",
        paperless_handoff_code: "ADM",
      },
    ])
    assert.equal(map.get(ORDER_A)?.paperlessHandoffCode, "ADM")
  })

  it("describes print vs QR readiness for the sales list", () => {
    assert.equal(
      sellerOpenShipmentLabelStatus({ hasPrintableLabel: true, hasPaperlessQr: true }),
      "Label and USPS QR ready",
    )
    assert.equal(
      sellerOpenShipmentLabelStatus({ hasPrintableLabel: false, hasPaperlessQr: true }),
      "USPS QR ready",
    )
    assert.equal(
      sellerOpenShipmentLabelStatus({ hasPrintableLabel: true, hasPaperlessQr: false }),
      "Label ready to print",
    )
    assert.equal(
      sellerOpenShipmentLabelStatus({ hasPrintableLabel: false, hasPaperlessQr: false }),
      "Needs a shipping label",
    )
  })
})
