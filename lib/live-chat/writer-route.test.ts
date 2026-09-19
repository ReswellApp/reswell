import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_DEFAULT_WRITER_MODELS,
  LIVE_CHAT_JEV_WRITER_CRITERIA,
  LIVE_CHAT_WRITER_FALLBACK,
  liveChatCsAgentWriterId,
  liveChatCsAgentWriterModel,
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
    assert.equal(liveChatWriterModelId("flash"), LIVE_CHAT_DEFAULT_WRITER_MODELS.flash)
    assert.equal(liveChatWriterModelId("pro"), "google/gemini-2.5-pro")
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
    assert.equal(liveChatCsAgentWriterModel("flash_lite"), LIVE_CHAT_DEFAULT_WRITER_MODELS.flash)
    assert.equal(liveChatCsAgentWriterModel("pro"), "google/gemini-2.5-pro")
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
