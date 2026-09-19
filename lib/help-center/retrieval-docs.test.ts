import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  getAllHelpRetrievalDocuments,
  getHelpRetrievalDocument,
  searchHelpRetrievalDocuments,
} from "./retrieval-docs.ts"

describe("help retrieval documents", () => {
  const docs = getAllHelpRetrievalDocuments()

  it("includes current product articles used by the topic index", () => {
    const ids = new Set(docs.map((doc) => doc.id))
    for (const id of [
      "buying/how-does-cart-work",
      "buying/how-board-finder-works",
      "buying/promo-codes",
      "buying/get-help-with-a-purchase",
      "selling/we-buy-your-surfboard",
      "selling/how-to-ship-an-order",
      "accounts/how-to-contact-support",
      "accounts/notifications",
    ]) {
      assert.ok(ids.has(id), id)
    }
  })

  it("uses unique ids and urls", () => {
    const ids = docs.map((doc) => doc.id)
    const urls = docs.map((doc) => doc.url)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(new Set(urls).size, urls.length)
  })

  it("requires retrieval fields used for ticket replies", () => {
    for (const doc of docs) {
      assert.ok(doc.title.trim(), doc.id)
      assert.ok(doc.quickAnswer.trim(), doc.id)
      assert.ok(doc.description.trim(), doc.id)
      assert.ok(doc.sections.length > 0, doc.id)
      assert.ok(doc.intentTags.length > 0, doc.id)
      assert.ok(doc.keywords.length > 0, doc.id)
      assert.match(doc.lastReviewed, /^\d{4}-\d{2}-\d{2}$/)
      for (const section of doc.sections) {
        assert.ok(section.text.trim(), `${doc.id} section`)
      }
    }
  })

  it("finds current product coverage by keyword", () => {
    const weBuy = searchHelpRetrievalDocuments("we'll buy").map((doc) => doc.slug)
    assert.ok(weBuy.includes("we-buy-your-surfboard"))

    const cart = searchHelpRetrievalDocuments("add to cart").map((doc) => doc.slug)
    assert.ok(cart.includes("how-does-cart-work"))

    const finder = searchHelpRetrievalDocuments("board finder").map((doc) => doc.slug)
    assert.ok(finder.includes("how-board-finder-works"))

    const promo = searchHelpRetrievalDocuments("promo code").map((doc) => doc.slug)
    assert.ok(promo.includes("promo-codes"))

    const payout = searchHelpRetrievalDocuments("get my money").map((doc) => doc.slug)
    assert.ok(payout.includes("how-long-to-get-paid"))
    assert.ok(payout.includes("how-cash-outs-work"))
  })

  it("looks up a document by topic and slug", () => {
    const doc = getHelpRetrievalDocument("selling", "marketplace-fees")
    assert.ok(doc)
    assert.match(doc.quickAnswer, /7%/)
  })
})
