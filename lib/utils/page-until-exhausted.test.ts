import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pageUntilExhausted } from "./page-until-exhausted.ts"

describe("pageUntilExhausted", () => {
  it("fetches every page until a short final page", async () => {
    const calls: Array<[number, number]> = []
    const all = Array.from({ length: 5 }, (_, i) => i)
    const rows = await pageUntilExhausted(async (from, to) => {
      calls.push([from, to])
      return all.slice(from, to + 1)
    }, 2)

    assert.deepEqual(rows, [0, 1, 2, 3, 4])
    assert.deepEqual(calls, [
      [0, 1],
      [2, 3],
      [4, 5],
    ])
  })

  it("stops after one request when the first page is short", async () => {
    let calls = 0
    const rows = await pageUntilExhausted(async () => {
      calls += 1
      return ["only"]
    }, 10)

    assert.deepEqual(rows, ["only"])
    assert.equal(calls, 1)
  })

  it("propagates fetch errors so callers cannot treat a failed search as empty", async () => {
    await assert.rejects(
      () =>
        pageUntilExhausted(async () => {
          throw new Error("profiles query failed")
        }),
      { message: "profiles query failed" },
    )
  })
})
