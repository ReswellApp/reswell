import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { messageAppearsToBePhishing } from "./detect-message-phishing.ts"

const PORTAL_CONFIRM_BLAST = `Hiya,

Just wanted to drop you a quick note with some good news — your RESWELL item has been sold.

There’s one small thing to check before we finish everything on our side. Please have a look at the payment details linked to your account and make sure all the information is still correct.

PORTAL_CONFIRM: xyhrfc.com/NIDLHU
Best,`

describe("messageAppearsToBePhishing", () => {
  it("flags the sold-item portal-confirm payout lure", () => {
    assert.equal(messageAppearsToBePhishing(PORTAL_CONFIRM_BLAST), true)
    assert.equal(messageAppearsToBePhishing("PORTAL_CONFIRM: xyhrfc.com/NIDLHU"), true)
    assert.equal(messageAppearsToBePhishing("your RESWELL item has been sold"), true)
    assert.equal(
      messageAppearsToBePhishing("Please check the payment details linked to your account"),
      true,
    )
  })

  it("does not flag ordinary marketplace chat", () => {
    assert.equal(messageAppearsToBePhishing("Hey, is this board still available?"), false)
    assert.equal(messageAppearsToBePhishing("Congrats on the sale!"), false)
  })
})
