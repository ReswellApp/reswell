import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { resolveLoginEntryAction } from "./login-entry-gate.ts"
import { serverSessionProbeFromStatus } from "./wait-for-server-session-ready.ts"

describe("login entry gate", () => {
  it("shows the form when nobody is signed in", () => {
    assert.equal(
      resolveLoginEntryAction({
        signedOut: false,
        hasClientUser: false,
        serverProbe: "anonymous",
        redirectPath: "/dashboard",
      }),
      "show-form",
    )
    assert.equal(
      resolveLoginEntryAction({
        signedOut: true,
        hasClientUser: true,
        serverProbe: "ready",
        redirectPath: "/",
      }),
      "show-form",
    )
  })

  it("redirects when the server can see the session", () => {
    assert.equal(
      resolveLoginEntryAction({
        signedOut: false,
        hasClientUser: true,
        serverProbe: "ready",
        redirectPath: "/dashboard/offers",
      }),
      "redirect",
    )
  })

  it("drops a client session the server rejects instead of bouncing", () => {
    assert.equal(
      resolveLoginEntryAction({
        signedOut: false,
        hasClientUser: true,
        serverProbe: "anonymous",
        redirectPath: "/messages",
      }),
      "clear-stale-session",
    )
  })

  it("still leaves login for a public path when the session probe is inconclusive", () => {
    assert.equal(
      resolveLoginEntryAction({
        signedOut: false,
        hasClientUser: true,
        serverProbe: "unknown",
        redirectPath: "/boards?q=fish",
      }),
      "redirect",
    )
  })

  it("keeps a protected redirect on the form when the session probe does not succeed", () => {
    assert.equal(
      resolveLoginEntryAction({
        signedOut: false,
        hasClientUser: true,
        serverProbe: "unknown",
        redirectPath: "/admin/orders",
      }),
      "show-form",
    )
  })
})

describe("server session probe status", () => {
  it("maps the session-ready responses", () => {
    assert.equal(serverSessionProbeFromStatus(204), "ready")
    assert.equal(serverSessionProbeFromStatus(401), "anonymous")
    assert.equal(serverSessionProbeFromStatus(500), "unknown")
    assert.equal(serverSessionProbeFromStatus(0), "unknown")
  })
})
