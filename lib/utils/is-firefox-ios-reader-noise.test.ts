import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isPostHogFirefoxIosReaderNoise } from "./is-firefox-ios-reader-noise.ts"

describe("isPostHogFirefoxIosReaderNoise", () => {
  it("drops the reported Firefox Reader Mode exception", () => {
    assert.equal(
      isPostHogFirefoxIosReaderNoise({
        event: "$exception",
        properties: {
          $exception_message:
            "TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')",
        },
      }),
      true,
    )
  })

  it("detects the signature in a nested PostHog exception", () => {
    assert.equal(
      isPostHogFirefoxIosReaderNoise({
        event: "$exception",
        properties: {
          $exception_list: [
            {
              type: "TypeError",
              value:
                "undefined is not an object (evaluating '__firefox__.reader.checkReadability')",
            },
          ],
        },
      }),
      true,
    )
  })

  it("keeps application TypeErrors", () => {
    assert.equal(
      isPostHogFirefoxIosReaderNoise({
        event: "$exception",
        properties: {
          $exception_message: "TypeError: undefined is not an object (evaluating 'listing.id')",
        },
      }),
      false,
    )
  })

  it("keeps non-exception analytics events", () => {
    assert.equal(
      isPostHogFirefoxIosReaderNoise({
        event: "listing_viewed",
        properties: {
          $exception_message: "window.__firefox__.reader",
        },
      }),
      false,
    )
  })
})
