import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { describe, it } from "node:test"

import {
  DEFER_UNTIL_IDLE_EVENTS,
  DEFER_UNTIL_IDLE_TIMEOUT_MS,
  deferUntilIdleOrInteraction,
} from "./defer-until-idle.ts"

class FakeTarget extends EventEmitter {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: unknown,
  ): void {
    this.on(type, listener as (...args: unknown[]) => void)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    _options?: unknown,
  ): void {
    this.off(type, listener as (...args: unknown[]) => void)
  }
}

describe("deferUntilIdleOrInteraction", () => {
  it("runs once on the first interaction event", () => {
    const target = new FakeTarget()
    let calls = 0
    const pendingTimeouts: Array<() => void> = []

    deferUntilIdleOrInteraction(() => {
      calls += 1
    }, {
      target,
      setTimeoutFn: (cb) => {
        pendingTimeouts.push(cb)
        return pendingTimeouts.length as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeoutFn: () => {},
    })

    target.emit("pointerdown")
    target.emit("keydown")
    for (const flush of pendingTimeouts) flush()

    assert.equal(calls, 1)
  })

  it("runs once when requestIdleCallback fires first", () => {
    const target = new FakeTarget()
    let calls = 0
    let idleCb: (() => void) | undefined

    deferUntilIdleOrInteraction(() => {
      calls += 1
    }, {
      target,
      requestIdleCallback: (cb) => {
        idleCb = cb
        return 1
      },
      cancelIdleCallback: () => {},
      setTimeoutFn: () => 1 as unknown as ReturnType<typeof setTimeout>,
      clearTimeoutFn: () => {},
    })

    idleCb?.()
    target.emit("scroll")

    assert.equal(calls, 1)
  })

  it("runs once on the timeout fallback when nothing else happens", () => {
    const target = new FakeTarget()
    let calls = 0
    let timeoutCb: (() => void) | undefined
    let timeoutMs: number | undefined

    deferUntilIdleOrInteraction(() => {
      calls += 1
    }, {
      target,
      setTimeoutFn: (cb, ms) => {
        timeoutCb = cb
        timeoutMs = ms
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeoutFn: () => {},
    })

    assert.equal(timeoutMs, DEFER_UNTIL_IDLE_TIMEOUT_MS)
    timeoutCb?.()
    timeoutCb?.()
    target.emit("touchstart")

    assert.equal(calls, 1)
  })

  it("cancel prevents a later timeout from running", () => {
    const target = new FakeTarget()
    let calls = 0
    let timeoutCb: (() => void) | undefined

    const cancel = deferUntilIdleOrInteraction(() => {
      calls += 1
    }, {
      target,
      setTimeoutFn: (cb) => {
        timeoutCb = cb
        return 1 as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeoutFn: () => {},
    })

    cancel()
    timeoutCb?.()
    target.emit("pointerdown")

    assert.equal(calls, 0)
  })

  it("listens for the documented first-input events", () => {
    assert.deepEqual([...DEFER_UNTIL_IDLE_EVENTS], [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ])
  })
})
