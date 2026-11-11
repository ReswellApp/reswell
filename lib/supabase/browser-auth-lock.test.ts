import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BrowserAuthLockTimeoutError,
  browserAuthLock,
  toInTabAcquireTimeout,
} from "./browser-auth-lock.ts"

describe("toInTabAcquireTimeout", () => {
  it("keeps 0 so auto-refresh can skip a busy lock", () => {
    assert.equal(toInTabAcquireTimeout(0), 0)
  })

  it("waits forever for every other auth-js wait budget", () => {
    assert.equal(toInTabAcquireTimeout(-1), -1)
    assert.equal(toInTabAcquireTimeout(1), -1)
    assert.equal(toInTabAcquireTimeout(10_000), -1)
  })
})

describe("browserAuthLock", () => {
  it("runs the operation when the lock is free", async () => {
    const value = await browserAuthLock("free", 50, async () => "ok")
    assert.equal(value, "ok")
  })

  it("runs later callers after the holder finishes", async () => {
    const order: string[] = []
    let releaseFirst: (() => void) | undefined
    const first = browserAuthLock("queue", -1, () => {
      order.push("first-start")
      return new Promise<void>((resolve) => {
        releaseFirst = () => {
          order.push("first-end")
          resolve()
        }
      })
    })
    const second = browserAuthLock("queue", -1, async () => {
      order.push("second")
      return "done"
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.deepEqual(order, ["first-start"])
    releaseFirst?.()
    assert.equal(await second, "done")
    await first
    assert.deepEqual(order, ["first-start", "first-end", "second"])
  })

  it("times out instead of waiting forever when the holder does not finish", async () => {
    let release: (() => void) | undefined
    const held = browserAuthLock("stuck", -1, () => {
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })

    await assert.rejects(
      browserAuthLock("stuck", 30, async () => "should-not-run"),
      (error: unknown) => {
        assert.ok(error instanceof BrowserAuthLockTimeoutError)
        assert.equal(
          (error as BrowserAuthLockTimeoutError).isAcquireTimeout,
          true,
        )
        return true
      },
    )

    release?.()
    await held
  })

  it("does not block the next caller after a timeout", async () => {
    let release: (() => void) | undefined
    const held = browserAuthLock("recover", -1, () => {
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })

    await assert.rejects(browserAuthLock("recover", 20, async () => "nope"))
    release?.()
    await held

    const value = await browserAuthLock("recover", 50, async () => "next")
    assert.equal(value, "next")
  })

  it("keeps a later caller behind the holder after an earlier timeout", async () => {
    const order: string[] = []
    let release: (() => void) | undefined
    const held = browserAuthLock("exclude", -1, () => {
      order.push("holder")
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })

    const timedOut = browserAuthLock("exclude", 20, async () => {
      order.push("timed-out")
    })
    await assert.rejects(timedOut)

    let started = false
    const later = browserAuthLock("exclude", -1, async () => {
      started = true
      order.push("later")
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(started, false)

    release?.()
    await held
    await later
    assert.deepEqual(order, ["holder", "later"])
  })

  it("fails immediately when acquireTimeout is 0 and the lock is held", async () => {
    let release: (() => void) | undefined
    const held = browserAuthLock("busy", -1, () => {
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })

    await assert.rejects(
      browserAuthLock("busy", 0, async () => "should-not-run"),
      (error: unknown) => error instanceof BrowserAuthLockTimeoutError,
    )

    release?.()
    await held
  })

  it("lets remapped waiters finish after a holder that outlives auth-js's 10s budget", async () => {
    let release: (() => void) | undefined
    const held = browserAuthLock("page-load", -1, () => {
      return new Promise<void>((resolve) => {
        release = resolve
      })
    })

    const waiter = browserAuthLock(
      "page-load",
      toInTabAcquireTimeout(10_000),
      async () => "session",
    )

    await new Promise((resolve) => setTimeout(resolve, 40))
    release?.()
    assert.equal(await waiter, "session")
    await held
  })
})
