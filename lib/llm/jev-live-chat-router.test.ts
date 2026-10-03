import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  fallbackLiveChatWriterRoute,
  liveChatJevRouterEnabled,
  routeLiveChatWriterWithJev,
} from "./jev-live-chat-router.ts"

const originalGateway = process.env.AI_GATEWAY_API_KEY
const originalFlag = process.env.LIVE_CHAT_JEV_ROUTER_ENABLED

afterEach(() => {
  if (originalGateway === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = originalGateway
  if (originalFlag === undefined) delete process.env.LIVE_CHAT_JEV_ROUTER_ENABLED
  else process.env.LIVE_CHAT_JEV_ROUTER_ENABLED = originalFlag
})

describe("Jev live-chat writer router", () => {
  it("falls back to pro without inventing a Jev score when Gateway is off", async () => {
    delete process.env.AI_GATEWAY_API_KEY
    process.env.LIVE_CHAT_JEV_ROUTER_ENABLED = "false"
    assert.equal(liveChatJevRouterEnabled(), false)

    let called = false
    const route = await routeLiveChatWriterWithJev(
      { visitorMessage: "How do I buy a surfboard on Reswell?", signedIn: false },
      {
        evaluate: async () => {
          called = true
          throw new Error("should not call Jev")
        },
      },
    )

    assert.equal(called, false)
    assert.equal(route.source, "fallback")
    assert.equal(route.writer, "pro")
    assert.equal(route.model, "anthropic/claude-sonnet-4.5")
    assert.match(route.reason, /Jev router off/)
  })

  it("uses Jev's writer choice when evaluate succeeds", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key"
    process.env.LIVE_CHAT_JEV_ROUTER_ENABLED = "true"

    const route = await routeLiveChatWriterWithJev(
      { visitorMessage: "How do I buy a surfboard on Reswell?", signedIn: false },
      {
        evaluate: async () =>
          ({
            answers: { writer: { type: "choice", choice: "flash" } },
          }) as never,
      },
    )

    assert.equal(route.source, "jev")
    assert.equal(route.writer, "flash")
    assert.equal(route.model, "anthropic/claude-haiku-4.5")
  })

  it("does not invent a writer when Jev throws", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key"
    process.env.LIVE_CHAT_JEV_ROUTER_ENABLED = "true"

    const route = await routeLiveChatWriterWithJev(
      { visitorMessage: "Where is my order?", signedIn: true },
      {
        evaluate: async () => {
          throw new Error("jev 404")
        },
      },
    )

    assert.equal(route.source, "fallback")
    assert.equal(route.writer, "pro")
    assert.match(route.reason, /jev 404/)
  })

  it("documents the honest pro fallback helper", () => {
    const route = fallbackLiveChatWriterRoute("manual")
    assert.equal(route.source, "fallback")
    assert.equal(route.writer, "pro")
    assert.equal(route.model, "anthropic/claude-sonnet-4.5")
  })
})
