import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildAgentNotFoundMarkdown } from "./not-found-markdown.ts"

describe("buildAgentNotFoundMarkdown", () => {
  const markdown = buildAgentNotFoundMarkdown("https://www.reswell.app")

  it("is markdown that reports a 404", () => {
    assert.match(markdown, /^# 404 Not Found/m)
    assert.match(markdown, /does not exist/i)
  })

  it("points agents at sitemap, llms.txt, OpenAPI, and docs", () => {
    assert.match(markdown, /https:\/\/www\.reswell\.app\/sitemap\.xml/)
    assert.match(markdown, /https:\/\/www\.reswell\.app\/llms\.txt/)
    assert.match(markdown, /https:\/\/www\.reswell\.app\/openapi\.json/)
    assert.match(markdown, /https:\/\/www\.reswell\.app\/public-api/)
  })
})
