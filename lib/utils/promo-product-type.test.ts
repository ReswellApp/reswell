import assert from "node:assert/strict"
import test from "node:test"
import {
  adminPromoProductTypeLabel,
  computeRestrictedPromoCheckoutAmounts,
  eligiblePromoItemSubtotalUsd,
  normalizeAdminPromoEligibleSections,
  promoDiscountScopePhrase,
  promoPreviewQuantity,
  promoProductTypeForListing,
  promoProductTypeRestrictionError,
  type PromoCheckoutLine,
} from "@/lib/utils/promo-product-type"

const lines: PromoCheckoutLine[] = [
  {
    listingId: "board",
    section: "surfboards",
    unitPriceUsd: 400,
    quantity: 1,
    productType: "surfboards",
  },
  {
    listingId: "fins",
    section: "fins",
    unitPriceUsd: 80,
    quantity: 1,
    productType: "fins",
  },
]

test("empty product limits mean the code applies to every item", () => {
  assert.equal(normalizeAdminPromoEligibleSections(null), null)
  assert.equal(normalizeAdminPromoEligibleSections([]), null)
  assert.equal(normalizeAdminPromoEligibleSections(["not-a-type"]), null)
  assert.equal(adminPromoProductTypeLabel(null), "All products")
  assert.equal(promoDiscountScopePhrase(null), "items")
})

test("a fins code discounts fins and leaves the board at full price", () => {
  assert.equal(eligiblePromoItemSubtotalUsd(lines, ["fins"]), 80)
  const amounts = computeRestrictedPromoCheckoutAmounts({
    itemSubtotalUsd: 480,
    eligibleItemSubtotalUsd: 80,
    shippingUsd: 20,
    discountPercent: 50,
  })
  assert.equal(amounts.discountUsd, 40)
  assert.equal(amounts.totalUsd, 460)
  assert.equal(promoProductTypeRestrictionError(["fins"]), "This code only works on fins.")
  assert.equal(adminPromoProductTypeLabel(["fins", "surfboards"]), "Surfboards, Fins")
})

test("shop fins use the Shopify product type when the listing section is new", () => {
  assert.equal(
    promoProductTypeForListing({ section: "new", shopifyReswellSection: "fins" }),
    "fins",
  )
  assert.equal(
    promoProductTypeForListing({ section: "fins", shopifyReswellSection: "surfboards" }),
    "fins",
  )
  assert.equal(promoProductTypeForListing({ section: "new" }), null)

  const shopFins: PromoCheckoutLine = {
    listingId: "shop-fins",
    section: "new",
    unitPriceUsd: 60,
    quantity: 2,
    productType: "fins",
  }
  assert.equal(eligiblePromoItemSubtotalUsd([shopFins, lines[0]!], ["fins"]), 120)
})

test("preview quantities follow the cart, except Shopify which is one unit", () => {
  assert.equal(
    promoPreviewQuantity({ section: "fins", requested: 4, stockQuantity: 4 }),
    4,
  )
  assert.equal(
    promoPreviewQuantity({
      section: "new",
      inventorySource: "shopify",
      requested: 3,
      stockQuantity: 8,
    }),
    1,
  )
  assert.equal(
    promoPreviewQuantity({
      section: "new",
      inventorySource: "reswell",
      requested: 5,
      stockQuantity: 2,
    }),
    2,
  )
})
