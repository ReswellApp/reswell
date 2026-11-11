import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { recordSearchSuggestPick } from "./search-suggest-analytics-client.ts"

const pick = {
  surface: "header_nav" as const,
  pickKind: "view_all_results" as const,
  suggestTrace: "marketplace_elasticsearch" as const,
  queryPrefix: "lost",
  selectionLabel: "lost mayhem",
  listingId: null,
}

describe("recordSearchSuggestPick", () => {
  it("does not POST hover dwells", () => {
    const calls: unknown[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args)
      return Promise.resolve(new Response("{}", { status: 200 }))
    }) as typeof fetch
    try {
      recordSearchSuggestPick({ ...pick, interaction: "hover" })
      assert.equal(calls.length, 0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("POSTs picks with keepalive so navigation is not blocked", () => {
    const calls: Array<{ url: unknown; init?: RequestInit }> = []
    const originalFetch = globalThis.fetch
    const hadWindow = "window" in globalThis
    const originalWindow = globalThis.window
    globalThis.window = globalThis as unknown as Window & typeof globalThis
    globalThis.fetch = ((url: unknown, init?: RequestInit) => {
      calls.push({ url, init })
      return Promise.resolve(new Response("{}", { status: 200 }))
    }) as typeof fetch
    try {
      recordSearchSuggestPick({ ...pick, interaction: "pick" })
      assert.equal(calls.length, 1)
      assert.equal(calls[0]?.url, "/api/search/suggest-pick")
      assert.equal(calls[0]?.init?.method, "POST")
      assert.equal(calls[0]?.init?.keepalive, true)
    } finally {
      globalThis.fetch = originalFetch
      if (hadWindow) globalThis.window = originalWindow
      else delete (globalThis as { window?: unknown }).window
    }
  })
})
