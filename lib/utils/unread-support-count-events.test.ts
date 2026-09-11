import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { countUnreadSupportMessages } from "./unread-support-count-events.ts"

describe("countUnreadSupportMessages", () => {
  it("counts agent replies after the member last read", () => {
    assert.equal(
      countUnreadSupportMessages(
        [
          { author_role: "agent", is_internal: false, created_at: "2026-09-11T10:00:00.000Z" },
          { author_role: "agent", is_internal: true, created_at: "2026-09-11T10:05:00.000Z" },
          { author_role: "customer", is_internal: false, created_at: "2026-09-11T10:10:00.000Z" },
          { author_role: "agent", is_internal: false, created_at: "2026-09-11T11:00:00.000Z" },
        ],
        "2026-09-11T10:30:00.000Z",
      ),
      1,
    )
  })

  it("counts every public agent message when the thread has never been opened", () => {
    assert.equal(
      countUnreadSupportMessages(
        [
          { author_role: "agent", is_internal: false, created_at: "2026-09-11T10:00:00.000Z" },
          { author_role: "system", is_internal: false, created_at: "2026-09-11T10:01:00.000Z" },
        ],
        null,
      ),
      1,
    )
  })
})
