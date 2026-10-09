import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"

import { navigateAfterSellerLabelPurchase } from "./navigate-after-seller-label-purchase.ts"

describe("navigateAfterSellerLabelPurchase", () => {
  const previousWindow = globalThis.window

  afterEach(() => {
    if (previousWindow) {
      globalThis.window = previousWindow
    } else {
      delete (globalThis as { window?: Window }).window
    }
  })

  it("loads the sale as a new document so the purchased label is not replayed from the router cache", () => {
    const assigned: string[] = []
    globalThis.window = {
      location: {
        assign(href: string) {
          assigned.push(href)
        },
      },
    } as unknown as Window & typeof globalThis

    navigateAfterSellerLabelPurchase("11111111-1111-4111-8111-111111111111")

    assert.deepEqual(assigned, ["/dashboard/sales/11111111-1111-4111-8111-111111111111"])
  })
})
