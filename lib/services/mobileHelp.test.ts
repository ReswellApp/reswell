import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getMobileHelpArticle, getMobileHelpHub, getMobileHelpTopic } from "./mobileHelp.ts"

describe("mobile help", () => {
  it("builds a hub with the website topics and featured articles", () => {
    const hub = getMobileHelpHub()
    assert.equal(hub.title, "Help Center")
    assert.deepEqual(
      hub.topics.map((topic) => topic.id),
      ["buying", "selling", "accounts"],
    )
    assert.ok(hub.topics.every((topic) => topic.article_count > 0))
    assert.ok(hub.featured.some((article) => article.slug === "how-do-i-buy-a-board"))
    assert.deepEqual(hub.results, [])
  })

  it("searches retrieval docs from the hub", () => {
    const hub = getMobileHelpHub("klarna")
    assert.ok(hub.results.some((article) => article.slug === "how-do-i-pay"))
  })

  it("builds the selling topic from the website index", () => {
    const result = getMobileHelpTopic("selling")
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.data.label, "Selling")
    const titles = result.data.sections.flatMap((section) =>
      section.groups.flatMap((group) => group.articles.map((article) => article.slug)),
    )
    assert.ok(titles.includes("marketplace-fees"))
    assert.ok(titles.includes("how-long-to-get-paid"))
  })

  it("returns the Klarna / how-do-i-pay article", () => {
    const result = getMobileHelpArticle("buying", "how-do-i-pay")
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.match(result.data.quick_answer, /Klarna/)
    assert.ok(result.data.sections.length > 0)
    assert.ok(result.data.related.length > 0)
  })

  it("404s unknown topics and slugs", () => {
    assert.equal(getMobileHelpTopic("unknown").ok, false)
    assert.equal(getMobileHelpArticle("buying", "missing-article").ok, false)
  })
})
