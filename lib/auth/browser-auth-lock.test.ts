import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { browserAuthLock } from "./browser-auth-lock.ts"

describe("browserAuthLock", () => {
  it("runs the operation when Chrome never releases the Web Lock", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        locks: {
          request: () => new Promise(() => {}),
        },
      },
    })

    try {
      const result = await browserAuthLock("sb-auth", 40, async () => "shown")
      assert.equal(result, "shown")
    } finally {
      if (previous) Object.defineProperty(globalThis, "navigator", previous)
      else delete (globalThis as { navigator?: unknown }).navigator
    }
  })
})
