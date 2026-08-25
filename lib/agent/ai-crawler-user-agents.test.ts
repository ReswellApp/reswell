import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { AI_CRAWLER_USER_AGENTS, isAiCrawlerUserAgent } from "./ai-crawler-user-agents.ts"

const REQUIRED_TOKENS = [
  "GPTBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "DeepSeekBot",
] as const

describe("AI crawler user agents", () => {
  it("allowlists the agents Ora reported as blocked", () => {
    for (const token of REQUIRED_TOKENS) {
      assert.ok(AI_CRAWLER_USER_AGENTS.includes(token), `missing ${token}`)
    }
  })

  it("matches real crawler User-Agent strings", () => {
    assert.equal(
      isAiCrawlerUserAgent(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)",
      ),
      true,
    )
    assert.equal(
      isAiCrawlerUserAgent(
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      ),
      true,
    )
    assert.equal(isAiCrawlerUserAgent("Mozilla/5.0 (compatible; Google-Extended)"), true)
    assert.equal(isAiCrawlerUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15"), false)
    assert.equal(isAiCrawlerUserAgent(null), false)
  })
})
