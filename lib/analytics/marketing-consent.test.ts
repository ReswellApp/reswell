import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { hasMarketingConsent, MARKETING_CONSENT_STORAGE_KEY } from "./marketing-consent.ts"

describe("hasMarketingConsent", () => {
  it("allows beacons when DNT and storage are unset", () => {
    assert.equal(hasMarketingConsent(), true)
  })

  it("denies beacons when Do Not Track is set", () => {
    const previous = globalThis.navigator
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { doNotTrack: "1" },
    })
    try {
      assert.equal(hasMarketingConsent(), false)
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previous,
      })
    }
  })

  it("denies beacons when the stored preference is denied", () => {
    const store = new Map<string, string>([[MARKETING_CONSENT_STORAGE_KEY, "denied"]])
    const previous = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
      },
    })
    try {
      assert.equal(hasMarketingConsent(), false)
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: previous,
      })
    }
  })
})
