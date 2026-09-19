import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS,
  LIVE_CHAT_DRAFT_MIN_RETRY_MS,
  LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS,
  liveChatGenerateAttemptBudgetMs,
} from "./generate-budget.ts"

const START = Date.parse("2026-09-19T15:00:00.000Z")

describe("live chat generate budget", () => {
  it("gives the first writer a full attempt when the shared clock is fresh", () => {
    assert.equal(LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS, 28_000)
    assert.equal(LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS, 45_000)
    assert.equal(LIVE_CHAT_DRAFT_MIN_RETRY_MS, 8_000)
    assert.equal(
      liveChatGenerateAttemptBudgetMs({ startedAtMs: START, nowMs: START }),
      LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS,
    )
  })

  it("shrinks the Pro retry to leftover time after an empty first writer", () => {
    assert.equal(
      liveChatGenerateAttemptBudgetMs({
        startedAtMs: START,
        nowMs: START + LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS,
        isRetry: true,
      }),
      LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS - LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS,
    )
    assert.ok(
      LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS +
        (LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS - LIVE_CHAT_DRAFT_ATTEMPT_BUDGET_MS) <=
        LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS,
    )
  })

  it("skips retry when leftover time is below the useful-generate floor", () => {
    assert.equal(
      liveChatGenerateAttemptBudgetMs({
        startedAtMs: START,
        nowMs: START + LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS - (LIVE_CHAT_DRAFT_MIN_RETRY_MS - 1),
        isRetry: true,
      }),
      0,
    )
    assert.equal(
      liveChatGenerateAttemptBudgetMs({
        startedAtMs: START,
        nowMs: START + LIVE_CHAT_DRAFT_TOTAL_BUDGET_MS,
        isRetry: true,
      }),
      0,
    )
  })
})
