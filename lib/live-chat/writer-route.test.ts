import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  APP_LLM_FEATURES,
  LIVE_CHAT_FAST_WRITER_MODEL,
  LIVE_CHAT_FRONTIER_WRITER_MODEL,
} from "../llm/app-models.ts"
import {
  LIVE_CHAT_DEFAULT_WRITER_MODELS,
  LIVE_CHAT_JEV_WRITER_CRITERIA,
  LIVE_CHAT_WRITER_FALLBACK,
  liveChatCsAgentWriterId,
  liveChatCsAgentWriterModel,
  liveChatCsSpendModels,
  liveChatWriterModelId,
  parseLiveChatWriterId,
} from "./writer-route.ts"

describe("live chat writer route", () => {
  it("parses Jev choice keys and rejects unknowns", () => {
    assert.equal(parseLiveChatWriterId("flash"), "flash")
    assert.equal(parseLiveChatWriterId("flash_lite"), "flash_lite")
    assert.equal(parseLiveChatWriterId("pro"), "pro")
    assert.equal(parseLiveChatWriterId("typesafe-ai/jev"), null)
    assert.equal(parseLiveChatWriterId("google/gemini-2.5-pro"), null)
  })

  it("maps writers to Gateway chat models, with env overrides", () => {
    assert.equal(LIVE_CHAT_WRITER_FALLBACK, "pro")
    assert.equal(LIVE_CHAT_DEFAULT_WRITER_MODELS.flash, LIVE_CHAT_FAST_WRITER_MODEL)
    assert.equal(LIVE_CHAT_DEFAULT_WRITER_MODELS.pro, LIVE_CHAT_FRONTIER_WRITER_MODEL)
    assert.equal(liveChatWriterModelId("flash"), LIVE_CHAT_FAST_WRITER_MODEL)
    assert.equal(liveChatWriterModelId("pro"), LIVE_CHAT_FRONTIER_WRITER_MODEL)
    assert.equal(LIVE_CHAT_FAST_WRITER_MODEL, "anthropic/claude-haiku-4.5")
    assert.equal(LIVE_CHAT_FRONTIER_WRITER_MODEL, "anthropic/claude-sonnet-4.5")
    assert.equal(
      liveChatWriterModelId("flash", { LIVE_CHAT_WRITER_FLASH_MODEL: "google/gemini-2.5-flash" }),
      "google/gemini-2.5-flash",
    )
    assert.equal(
      liveChatWriterModelId("pro", { LIVE_CHAT_WRITER_PRO_MODEL: "google/gemini-2.5-pro" }),
      "google/gemini-2.5-pro",
    )
  })

  it("upgrades flash_lite to flash for the CS agent harness", () => {
    assert.equal(liveChatCsAgentWriterId("flash_lite"), "flash")
    assert.equal(liveChatCsAgentWriterId("flash"), "flash")
    assert.equal(liveChatCsAgentWriterId("pro"), "pro")
    assert.equal(liveChatCsAgentWriterModel("flash_lite"), LIVE_CHAT_FAST_WRITER_MODEL)
    assert.equal(liveChatCsAgentWriterModel("pro"), LIVE_CHAT_FRONTIER_WRITER_MODEL)
    assert.deepEqual(liveChatCsSpendModels(), [
      LIVE_CHAT_FAST_WRITER_MODEL,
      LIVE_CHAT_FRONTIER_WRITER_MODEL,
    ])
  })

  it("keeps live_chat_cs catalog default on the frontier writer for /admin/llm-usage", () => {
    const feature = APP_LLM_FEATURES.find((row) => row.id === "live_chat_cs")
    assert.equal(feature?.defaultModel, LIVE_CHAT_FRONTIER_WRITER_MODEL)
    assert.equal(feature?.modelEnvVar, "LIVE_CHAT_CS_MODEL")
    assert.equal(feature?.gatewayFeatureTag, "feature:live-chat-cs")
  })

  it("keeps how-to asks on flash and order facts on pro in the Jev rubric", () => {
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.flash, /buying a board/i)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.flash, /fees/i)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.flash, /how sellers get paid/i)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.pro, /tracking/)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.pro, /payout status/)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.pro, /Generic how-tos/)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.flash_lite, /Greeting/)
    assert.match(LIVE_CHAT_JEV_WRITER_CRITERIA.flash_lite, /thanks/i)
  })
})
