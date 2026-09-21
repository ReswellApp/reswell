import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  exampleColumnSet,
  isMissingDraftHarnessColumn,
  isMissingExampleExtendedColumn,
  isMissingExampleRatingNoteColumn,
  isMissingExampleSourceChannelColumn,
} from "./support-reply-schema.ts"

describe("support reply schema misses", () => {
  it("matches the production postgres 42703 messages", () => {
    assert.equal(
      isMissingDraftHarnessColumn("column support_reply_drafts.reason does not exist"),
      true,
    )
    assert.equal(
      isMissingDraftHarnessColumn(
        'column "citations" of relation "support_reply_drafts" does not exist',
      ),
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

  it("matches PostgREST schema-cache misses for the named column only", () => {
    assert.equal(
      isMissingDraftHarnessColumn(
        "Could not find the 'reason' column of 'support_reply_drafts' in the schema cache",
      ),
      true,
    )
    assert.equal(
      isMissingExampleRatingNoteColumn(
        "Could not find the 'rating_note' column of 'support_reply_examples' in the schema cache",
      ),
      true,
    )
    assert.equal(
      isMissingExampleSourceChannelColumn(
        "Could not find the 'source_channel' column of 'support_reply_examples' in the schema cache",
      ),
      true,
    )
    assert.equal(
      isMissingDraftHarnessColumn(
        "Could not find the table 'public.banned_access_signals' in the schema cache",
      ),
      false,
    )
    assert.equal(
      isMissingExampleExtendedColumn(
        "Could not find the 'auto_price_drop_scheduled_for' column of 'listings' in the schema cache",
      ),
      false,
    )
    assert.equal(isMissingDraftHarnessColumn("Request aborted for some reason"), false)
    assert.equal(
      isMissingExampleRatingNoteColumn(
        "Could not find the 'source_channel' column of 'support_reply_examples' in the schema cache",
      ),
      false,
    )
  })

  it("keeps source_channel writable when only rating_note is latched", () => {
    assert.equal(
      exampleColumnSet({
        nowMs: 1_000,
        ratingNoteUnavailableUntilMs: 10_000,
        sourceChannelUnavailableUntilMs: 0,
      }),
      "channel",
    )
    assert.equal(
      exampleColumnSet({
        nowMs: 1_000,
        ratingNoteUnavailableUntilMs: 10_000,
        sourceChannelUnavailableUntilMs: 10_000,
      }),
      "base",
    )
    assert.equal(
      exampleColumnSet({
        nowMs: 1_000,
        ratingNoteUnavailableUntilMs: 0,
        sourceChannelUnavailableUntilMs: 0,
      }),
      "full",
    )
  })
})
