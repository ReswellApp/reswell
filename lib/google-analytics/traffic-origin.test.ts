import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  classifyTrafficOrigin,
  formatMediumLabel,
  formatSourceLabel,
  mergeSourceMediumRows,
  referrerHostname,
  rollupReferrersByHost,
  rollupTrafficOrigins,
} from "./traffic-origin.ts"

describe("classifyTrafficOrigin", () => {
  it("tags ChatGPT, Claude, and Google from session source", () => {
    assert.equal(classifyTrafficOrigin({ source: "chatgpt.com", medium: "referral" }), "chatgpt")
    assert.equal(classifyTrafficOrigin({ source: "chat.openai.com", medium: "referral" }), "chatgpt")
    assert.equal(classifyTrafficOrigin({ source: "com.openai.chat", medium: "referral" }), "chatgpt")
    assert.equal(classifyTrafficOrigin({ source: "claude.ai", medium: "referral" }), "claude")
    assert.equal(classifyTrafficOrigin({ source: "google", medium: "organic" }), "google")
    assert.equal(classifyTrafficOrigin({ source: "google", medium: "cpc" }), "google")
  })

  it("tags Gemini before generic Google, and Copilot/Bing separately", () => {
    assert.equal(classifyTrafficOrigin({ source: "gemini.google.com", medium: "referral" }), "gemini")
    assert.equal(classifyTrafficOrigin({ referrer: "https://bard.google.com/app" }), "gemini")
    assert.equal(classifyTrafficOrigin({ source: "bing", medium: "organic" }), "copilot")
    assert.equal(classifyTrafficOrigin({ source: "copilot.microsoft.com", medium: "referral" }), "copilot")
  })

  it("reads AI hosts from the referring page URL", () => {
    assert.equal(
      classifyTrafficOrigin({ source: "(direct)", medium: "(none)", referrer: "https://chatgpt.com/c/abc" }),
      "chatgpt",
    )
    assert.equal(
      classifyTrafficOrigin({ source: "referral", referrer: "https://www.perplexity.ai/search?q=reswell" }),
      "perplexity",
    )
    assert.equal(classifyTrafficOrigin({ referrer: "https://claude.ai/chat/123" }), "claude")
  })

  it("groups Meta, YouTube, and typed-in Direct", () => {
    assert.equal(classifyTrafficOrigin({ source: "l.facebook.com", medium: "referral" }), "meta")
    assert.equal(classifyTrafficOrigin({ source: "instagram", medium: "social" }), "meta")
    assert.equal(classifyTrafficOrigin({ source: "youtube.com", medium: "referral" }), "youtube")
    assert.equal(classifyTrafficOrigin({ source: "(direct)", medium: "(none)" }), "direct")
  })

  it("leaves unknown referring sites as other", () => {
    assert.equal(classifyTrafficOrigin({ source: "stabmag.com", medium: "referral" }), "other")
    assert.equal(classifyTrafficOrigin({ referrer: "https://news.ycombinator.com/item?id=1" }), "other")
  })

  it("does not treat a named source with a missing medium as Direct", () => {
    assert.equal(classifyTrafficOrigin({ source: "stabmag.com", medium: "(none)" }), "other")
    assert.equal(classifyTrafficOrigin({ source: "newsletter", medium: "(not set)" }), "other")
    assert.equal(classifyTrafficOrigin({ source: "stabmag.com", medium: "" }), "other")
    assert.equal(classifyTrafficOrigin({ source: "(direct)", medium: "(none)" }), "direct")
    assert.equal(classifyTrafficOrigin({ source: "(not set)", medium: "(not set)" }), "direct")
  })
})

describe("referrerHostname", () => {
  it("strips www and returns an empty host for direct", () => {
    assert.equal(referrerHostname("https://www.chatgpt.com/share/abc"), "chatgpt.com")
    assert.equal(referrerHostname("(direct)"), "")
    assert.equal(referrerHostname(""), "")
  })
})

describe("rollupTrafficOrigins", () => {
  it("always includes ChatGPT, Claude, Google, and Direct", () => {
    const rolled = rollupTrafficOrigins([
      { origin: "google", sessions: 12, views: 20, conversions: 1 },
      { origin: "other", sessions: 3, views: 4, conversions: 0 },
    ])
    const ids = rolled.map((row) => row.origin)
    assert.deepEqual(ids, ["chatgpt", "claude", "google", "direct", "other"])
    assert.equal(rolled.find((row) => row.origin === "chatgpt")?.sessions, 0)
    assert.equal(rolled.find((row) => row.origin === "google")?.sessions, 12)
  })
})

describe("source and medium labels", () => {
  it("normalizes empty GA placeholders", () => {
    assert.equal(formatSourceLabel("(not set)"), "(direct)")
    assert.equal(formatMediumLabel("(none)"), "(none)")
    assert.equal(formatSourceLabel("chatgpt.com"), "chatgpt.com")
  })
})

describe("mergeSourceMediumRows", () => {
  it("sums placeholder pairs that collapse to the same Direct labels", () => {
    const merged = mergeSourceMediumRows([
      { source: "(direct)", medium: "(none)", sessions: 10, views: 12, conversions: 1 },
      { source: "(direct)", medium: "(none)", sessions: 3, views: 4, conversions: 0 },
      { source: "google", medium: "organic", sessions: 8, views: 9, conversions: 2 },
    ])
    assert.equal(merged.length, 2)
    assert.equal(merged[0]?.source, "(direct)")
    assert.equal(merged[0]?.sessions, 13)
    assert.equal(merged[0]?.views, 16)
    assert.equal(merged[0]?.conversions, 1)
    assert.equal(merged[1]?.source, "google")
    assert.equal(merged[1]?.sessions, 8)
  })
})

describe("rollupReferrersByHost", () => {
  it("groups unique ChatGPT URLs onto one host and skips same-site paths", () => {
    const rolled = rollupReferrersByHost([
      { referrer: "https://www.reswell.app/l/foo", sessions: 40 },
      { referrer: "https://www.reswell.app/boards", sessions: 30 },
      { referrer: "https://chatgpt.com/c/aaa", sessions: 1 },
      { referrer: "https://chatgpt.com/c/bbb", sessions: 1 },
      { referrer: "https://claude.ai/chat/1", sessions: 2 },
    ])
    assert.equal(
      rolled.find((row) => row.host === "reswell.app"),
      undefined,
    )
    assert.equal(rolled.find((row) => row.host === "chatgpt.com")?.sessions, 2)
    assert.equal(rolled.find((row) => row.host === "chatgpt.com")?.origin, "chatgpt")
    assert.equal(rolled.find((row) => row.host === "claude.ai")?.sessions, 2)
  })
})
