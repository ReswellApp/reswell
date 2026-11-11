import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isServerActionRequest } from "./is-server-action-request.ts"

function headers(names: string[]) {
  const set = new Set(names.map((name) => name.toLowerCase()))
  return {
    has(name: string) {
      return set.has(name.toLowerCase())
    },
  }
}

describe("isServerActionRequest", () => {
  it("matches Next.js Next-Action posts", () => {
    assert.equal(isServerActionRequest({ headers: headers(["next-action"]) }), true)
    assert.equal(isServerActionRequest({ headers: headers(["Next-Action"]) }), true)
  })

  it("ignores ordinary document and RSC navigations", () => {
    assert.equal(isServerActionRequest({ headers: headers([]) }), false)
    assert.equal(isServerActionRequest({ headers: headers(["rsc"]) }), false)
  })
})
