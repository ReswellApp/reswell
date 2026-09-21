import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isMissingDraftHarnessColumn,
  isMissingExampleExtendedColumn,
} from "./support-reply-schema.ts"

describe("support reply schema misses", () => {
  it("matches the production postgres 42703 messages", () => {
    assert.equal(
      isMissingDraftHarnessColumn("column support_reply_drafts.reason does not exist"),
      true,
    )
    assert.equal(
      isMissingExampleExtendedColumn(
        "column support_reply_examples.rating_note does not exist",
      ),
      true,
    )
    assert.equal(isMissingExampleExtendedColumn("column listings.price does not exist"), false)
    assert.equal(isMissingDraftHarnessColumn("JWT expired"), false)
  })
})
