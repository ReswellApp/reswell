import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pngUrlFromPdfUrl } from "@/lib/shipping/png-url-from-pdf-url"

describe("pngUrlFromPdfUrl", () => {
  it("swaps a ShipEngine PDF download for the PNG sibling", () => {
    assert.equal(
      pngUrlFromPdfUrl("https://api.shipengine.com/v1/downloads/abc/label.pdf"),
      "https://api.shipengine.com/v1/downloads/abc/label.png",
    )
  })

  it("returns null when the path is not a PDF", () => {
    assert.equal(pngUrlFromPdfUrl("https://api.shipengine.com/v1/downloads/abc/label.png"), null)
  })
})
