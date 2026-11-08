import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAbortError,
  isBenignClientFetchError,
  isPostHogBenignClientFetchError,
} from "./is-abort-error.ts"

describe("isBenignClientFetchError", () => {
  it("matches browser fetch failures", () => {
    assert.equal(isBenignClientFetchError(new TypeError("Failed to fetch")), true)
    assert.equal(isBenignClientFetchError(new TypeError("Load failed")), true)
    assert.equal(
      isBenignClientFetchError(
        new TypeError("NetworkError when attempting to fetch resource."),
      ),
      true,
    )
  })

  it("matches Next.js unexpected Server Action responses", () => {
    assert.equal(
      isBenignClientFetchError(
        new Error("An unexpected response was received from the server."),
      ),
      true,
    )
    assert.equal(
      isBenignClientFetchError(
        "Error: An unexpected response was received from the server.",
      ),
      true,
    )
    assert.equal(isAbortError(new Error("An unexpected response was received from the server.")), false)
  })

  it("does not match application errors", () => {
    assert.equal(isBenignClientFetchError(new Error("Unauthorized")), false)
    assert.equal(isBenignClientFetchError("Could not save listing"), false)
  })
})

describe("isPostHogBenignClientFetchError", () => {
  it("drops the Next.js Server Action protocol exception", () => {
    assert.equal(
      isPostHogBenignClientFetchError({
        event: "$exception",
        properties: {
          $exception_message: "An unexpected response was received from the server.",
        },
      }),
      true,
    )
    assert.equal(
      isPostHogBenignClientFetchError({
        event: "$pageview",
        properties: {
          $exception_message: "An unexpected response was received from the server.",
        },
      }),
      false,
    )
  })
})
