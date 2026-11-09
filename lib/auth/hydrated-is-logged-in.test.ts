import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveHydratedIsLoggedIn } from "@/lib/auth/hydrated-is-logged-in"

describe("resolveHydratedIsLoggedIn", () => {
  it("trusts the server when the request was personalized", () => {
    assert.equal(
      resolveHydratedIsLoggedIn({
        serverIsLoggedIn: true,
        viewerUserId: null,
        clientLoggedIn: false,
      }),
      true,
    )
  })

  it("treats a hydrated listing-viewer id as signed in on cached guest HTML", () => {
    assert.equal(
      resolveHydratedIsLoggedIn({
        serverIsLoggedIn: false,
        viewerUserId: "user-1",
        clientLoggedIn: false,
      }),
      true,
    )
  })

  it("keeps a confirmed browser session when the viewer id has not painted yet", () => {
    assert.equal(
      resolveHydratedIsLoggedIn({
        serverIsLoggedIn: false,
        viewerUserId: null,
        clientLoggedIn: true,
      }),
      true,
    )
  })

  it("stays signed out for guests", () => {
    assert.equal(
      resolveHydratedIsLoggedIn({
        serverIsLoggedIn: false,
        viewerUserId: null,
        clientLoggedIn: false,
      }),
      false,
    )
  })
})
