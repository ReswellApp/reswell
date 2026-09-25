import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cloneEmailDocument, starterById } from "./document.ts"
import { renderEmailStudioHtml, safeEmailHref } from "./render-html.ts"

describe("email studio html", () => {
  it("drops unsafe links and keeps Klaviyo tags", () => {
    assert.equal(safeEmailHref("javascript:alert(1)"), "")
    assert.equal(safeEmailHref("https://www.reswell.app/boards"), "https://www.reswell.app/boards")
    assert.equal(
      safeEmailHref("{{ event|lookup:'order_url' }}"),
      "{{ event|lookup:'order_url' }}",
    )
  })

  it("renders a buyer order starter as a table email", () => {
    const starter = starterById("buyer-order")
    assert.ok(starter)
    const html = renderEmailStudioHtml({
      name: "Buyer order",
      subject: starter.subject,
      previewText: starter.previewText,
      flowName: "Purchase Successful",
      triggerMetric: starter.triggerMetric,
      document: cloneEmailDocument(starter.document),
    })
    assert.match(html, /<!DOCTYPE html>/)
    assert.match(html, /max-width:560px/)
    assert.match(html, /\{% unsubscribe 'Unsubscribe' %\}/)
    assert.match(html, /event\|lookup:'order_num'/)
    assert.doesNotMatch(html, /<script/i)
    assert.match(html, /Trigger metric: Purchase Successful/)
  })
})