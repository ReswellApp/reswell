import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createFinListingSchema } from "@/lib/validations/fin-listing"
import {
  validateFinListingForm,
  type FinSellFormValidationInput,
} from "./validate-fin-listing-form"

const ready = { imageCount: 1, imagesUploadReady: true, videoUploadReady: true }

function form(price: string): FinSellFormValidationInput {
  return {
    title: "FCS Reactor",
    description: "Lightly used thruster set.",
    price,
    condition: "good",
    locationCity: "San Diego",
    locationState: "CA",
    shippingAvailable: true,
    localPickup: false,
    shippingMode: "free",
    shippingPrice: "",
    reswellPackageLengthIn: "",
    reswellPackageWidthIn: "",
    reswellPackageHeightIn: "",
    reswellPackageWeightLb: "",
    reswellPackageWeightOz: "",
  }
}

describe("validateFinListingForm price", () => {
  it("accepts a listing price that is already filled in", () => {
    assert.equal(validateFinListingForm(form("85"), ready), null)
    assert.equal(validateFinListingForm(form("1,200"), ready), null)
    assert.equal(validateFinListingForm(form("$40.00"), ready), null)
  })

  it("asks for a price only when the field is empty", () => {
    assert.equal(validateFinListingForm(form(""), ready), "Enter a listing price.")
    assert.equal(validateFinListingForm(form("   "), ready), "Enter a listing price.")
  })
})

describe("createFinListingSchema price", () => {
  const base = {
    title: "FCS Reactor",
    description: "Lightly used thruster set.",
    condition: "good",
    locationCity: "San Diego",
    locationState: "CA",
    shippingAvailable: true,
    localPickup: false,
    shippingCostMode: "free" as const,
    images: [{ url: "https://example.com/fin.jpg" }],
  }

  it("keeps a filled-in listing price", () => {
    for (const [price, expected] of [
      ["85", 85],
      ["1,200", 1200],
      ["$40.00", 40],
    ] as const) {
      const parsed = createFinListingSchema.safeParse({ ...base, price })
      assert.equal(parsed.success, true)
      if (parsed.success) assert.equal(parsed.data.price, expected)
    }
  })
})
