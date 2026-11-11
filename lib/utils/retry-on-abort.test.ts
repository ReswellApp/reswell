import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { retryOnceOnAbort } from "./retry-on-abort.ts"

describe("retryOnceOnAbort", () => {
  it("returns the first success without retrying", async () => {
    let calls = 0
    const result = await retryOnceOnAbort(async () => {
      calls += 1
      return "ok"
    }, 0)
    assert.equal(result, "ok")
    assert.equal(calls, 1)
  })

  it("retries once after an abort and returns the second result", async () => {
    let calls = 0
    const result = await retryOnceOnAbort(async () => {
      calls += 1
      if (calls === 1) {
        const error = new Error("The user aborted a request.")
        error.name = "AbortError"
        throw error
      }
      return "recovered"
    }, 0)
    assert.equal(result, "recovered")
    assert.equal(calls, 2)
  })

  it("does not retry a non-abort failure", async () => {
    let calls = 0
    await assert.rejects(
      () =>
        retryOnceOnAbort(async () => {
          calls += 1
          throw new Error("boom")
        }, 0),
      /boom/,
    )
    assert.equal(calls, 1)
  })
})
