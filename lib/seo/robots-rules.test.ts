import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { AI_CRAWLER_USER_AGENTS } from "../agent/ai-crawler-user-agents.ts"
import { ROBOTS_PUBLIC_ALLOW_PATHS } from "./robots-public-paths.ts"

describe("robots public allow paths", () => {
  it("keeps a dedicated AI crawler list", () => {
    assert.ok(AI_CRAWLER_USER_AGENTS.includes("GPTBot"))
    assert.ok(AI_CRAWLER_USER_AGENTS.includes("ChatGPT-User"))
    assert.ok(AI_CRAWLER_USER_AGENTS.includes("ClaudeBot"))
    assert.ok(AI_CRAWLER_USER_AGENTS.includes("Google-Extended"))
  })

  it("allows homepage, public API, OpenAPI, and llms.txt", () => {
    assert.ok(ROBOTS_PUBLIC_ALLOW_PATHS.includes("/"))
    assert.ok(ROBOTS_PUBLIC_ALLOW_PATHS.includes("/api/public/"))
    assert.ok(ROBOTS_PUBLIC_ALLOW_PATHS.includes("/openapi.json"))
    assert.ok(ROBOTS_PUBLIC_ALLOW_PATHS.includes("/llms.txt"))
  })
})
