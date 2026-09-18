import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createUploadStallWatch, UploadStallError } from "./upload-stall-watch.ts"

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("createUploadStallWatch", () => {
  it("fires onStall after silence", async () => {
    let stalled = false
    const watch = createUploadStallWatch({
      stallMs: 20,
      onStall: () => {
        stalled = true
      },
    })
    await wait(50)
    assert.equal(stalled, true)
    watch.stop()
  })

  it("does not fire when progress keeps arriving", async () => {
    let stalled = false
    const watch = createUploadStallWatch({
      stallMs: 30,
      onStall: () => {
        stalled = true
      },
    })
    const interval = setInterval(() => watch.ping(), 8)
    await wait(55)
    clearInterval(interval)
    watch.stop()
    assert.equal(stalled, false)
  })

  it("stop prevents a pending stall", async () => {
    let stalled = false
    const watch = createUploadStallWatch({
      stallMs: 30,
      onStall: () => {
        stalled = true
      },
    })
    watch.stop()
    await wait(50)
    assert.equal(stalled, false)
  })
})

describe("UploadStallError", () => {
  it("is a named error with retry copy", () => {
    const err = new UploadStallError()
    assert.equal(err.name, "UploadStallError")
    assert.match(err.message, /stalled/i)
  })
})
