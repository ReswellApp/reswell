import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_SESSION_STALE_MS,
  isLiveChatSessionStale,
  liveChatSessionActivityAt,
  shouldResumeLiveChatSession,
} from "./session-expiry.ts"

const NOW = Date.parse("2026-09-19T15:00:00.000Z")

describe("live chat session expiry", () => {
  it("resumes an unresolved thread from the last few hours", () => {
    assert.equal(
      shouldResumeLiveChatSession({
        status: "open",
        lastActivityAt: "2026-09-19T12:00:00.000Z",
        nowMs: NOW,
      }),
      true,
    )
    assert.equal(
      shouldResumeLiveChatSession({
        status: "assigned",
        lastActivityAt: "2026-09-19T14:59:00.000Z",
        nowMs: NOW,
      }),
      true,
    )
  })

  it("does not resume resolved or closed threads", () => {
    assert.equal(
      shouldResumeLiveChatSession({
        status: "resolved",
        lastActivityAt: "2026-09-19T14:50:00.000Z",
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(
      shouldResumeLiveChatSession({
        status: "closed",
        lastActivityAt: "2026-09-19T14:50:00.000Z",
        nowMs: NOW,
      }),
      false,
    )
  })

  it("treats a day-old open thread as stale even if status is still open", () => {
    assert.equal(
      shouldResumeLiveChatSession({
        status: "open",
        lastActivityAt: "2026-09-18T14:59:00.000Z",
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(
      isLiveChatSessionStale({
        lastActivityAt: "2026-09-18T15:00:00.000Z",
        nowMs: NOW,
      }),
      true,
    )
    assert.equal(
      isLiveChatSessionStale({
        lastActivityAt: "2026-09-18T15:00:01.000Z",
        nowMs: NOW,
      }),
      false,
    )
    assert.equal(LIVE_CHAT_SESSION_STALE_MS, 24 * 60 * 60 * 1000)
  })

  it("picks the newest message activity and ignores metadata updated_at", () => {
    assert.equal(
      liveChatSessionActivityAt({
        last_message_at: "2026-09-19T10:00:00.000Z",
        last_visitor_message_at: "2026-09-19T11:00:00.000Z",
        created_at: "2026-09-18T10:00:00.000Z",
      }),
      "2026-09-19T11:00:00.000Z",
    )
    assert.equal(
      liveChatSessionActivityAt({
        created_at: "2026-09-18T10:00:00.000Z",
      }),
      "2026-09-18T10:00:00.000Z",
    )
    assert.equal(
      liveChatSessionActivityAt({
        last_message_at: "2026-09-18T10:00:00.000Z",
        updated_at: "2026-09-19T14:50:00.000Z",
        created_at: "2026-09-17T10:00:00.000Z",
      }),
      "2026-09-18T10:00:00.000Z",
    )
    assert.equal(
      shouldResumeLiveChatSession({
        status: "open",
        lastActivityAt: liveChatSessionActivityAt({
          last_message_at: "2026-09-18T14:59:00.000Z",
          updated_at: "2026-09-19T14:50:00.000Z",
          created_at: "2026-09-17T10:00:00.000Z",
        }),
        nowMs: NOW,
      }),
      false,
    )
  })
})
