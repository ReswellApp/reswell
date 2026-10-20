import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BOARD_SAVED_SEARCH_ALERT_RETRY_SECONDS,
  BOARD_SAVED_SEARCH_ALERT_WINDOW_MS,
  boardSavedSearchAlertRetryDecision,
} from "./boardSavedSearchAlertQueue.ts"

const createdAtMs = Date.parse("2026-10-16T18:00:00.000Z")

describe("boardSavedSearchAlertRetryDecision", () => {
  it("retries an index miss 15 minutes later", () => {
    assert.deepEqual(
      boardSavedSearchAlertRetryDecision({
        deliveryCount: 1,
        createdAtMs,
        nowMs: createdAtMs,
        reason: "index_pending",
      }),
      { afterSeconds: BOARD_SAVED_SEARCH_ALERT_RETRY_SECONDS },
    )
  })

  it("stops after four deliveries", () => {
    assert.deepEqual(
      boardSavedSearchAlertRetryDecision({
        deliveryCount: 4,
        createdAtMs,
        nowMs: createdAtMs + 45 * 60 * 1000,
        reason: "index_pending",
      }),
      { acknowledge: true },
    )
  })

  it("stops an hour after the board was published", () => {
    assert.deepEqual(
      boardSavedSearchAlertRetryDecision({
        deliveryCount: 2,
        createdAtMs,
        nowMs: createdAtMs + BOARD_SAVED_SEARCH_ALERT_WINDOW_MS,
        reason: "failed",
      }),
      { acknowledge: true },
    )
  })
})
