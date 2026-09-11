import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  caseHasMemberReply,
  inboxCounterpartLabel,
  staffReplyPlaceholder,
  staffSentToast,
  staffWaitingStatusLabel,
  staffWorkflowStatusLabel,
} from "./case-inbox-counterpart.ts"

describe("inbox counterpart copy", () => {
  it("names sellers and buyers instead of customer", () => {
    assert.equal(inboxCounterpartLabel("seller"), "Seller")
    assert.equal(inboxCounterpartLabel("buyer"), "Buyer")
    assert.equal(inboxCounterpartLabel("member"), "Member")
    assert.equal(inboxCounterpartLabel("guest"), "Member")
  })

  it("labels staff outreach as waiting on the seller, not a customer", () => {
    assert.equal(
      staffWaitingStatusLabel({ requesterRole: "seller", openedBy: "staff" }),
      "Waiting on seller",
    )
    assert.equal(
      staffWorkflowStatusLabel("waiting_on_you", { requesterRole: "seller", openedBy: "staff" }),
      "Waiting on seller",
    )
    assert.equal(staffReplyPlaceholder("seller"), "Write a reply the seller will see…")
    assert.equal(staffSentToast("seller"), "Sent to seller")
  })

  it("treats a thread with only agent messages as no member reply", () => {
    assert.equal(
      caseHasMemberReply([
        { author_role: "agent", is_internal: false },
        { author_role: "system", is_internal: false },
      ]),
      false,
    )
    assert.equal(caseHasMemberReply([{ author_role: "customer", is_internal: false }]), true)
  })
})
