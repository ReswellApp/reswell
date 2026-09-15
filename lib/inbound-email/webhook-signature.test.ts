import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"

import {
  InboundEmailMissingAuthError,
  InboundEmailSignatureError,
  InboundEmailTimestampError,
  verifyInboundEmailWebhookAuth,
} from "./webhook-signature.ts"

const SECRET = "whsec_dGVzdC1zaWduaW5nLXNlY3JldC1ieXRlcw=="
const RAW = '{"type":"email.received","data":{"email_id":"abc"}}'

function svixSignature(id: string, timestamp: string, body: string): string {
  const key = Buffer.from("dGVzdC1zaWduaW5nLXNlY3JldC1ieXRlcw==", "base64")
  const digest = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`, "utf8").digest("base64")
  return `v1,${digest}`
}

describe("inbound email webhook auth", () => {
  it("accepts a valid Svix signature", () => {
    const id = "msg_test"
    const timestamp = String(Math.floor(Date.now() / 1000))
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": svixSignature(id, timestamp, RAW),
    })
    verifyInboundEmailWebhookAuth({ rawBody: RAW, headers, secret: SECRET })
  })

  it("rejects a bad Svix signature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const headers = new Headers({
      "svix-id": "msg_test",
      "svix-timestamp": timestamp,
      "svix-signature": "v1,not-a-real-signature====",
    })
    assert.throws(
      () => verifyInboundEmailWebhookAuth({ rawBody: RAW, headers, secret: SECRET }),
      InboundEmailSignatureError,
    )
  })

  it("rejects a stale timestamp", () => {
    const id = "msg_old"
    const timestamp = String(Math.floor(Date.now() / 1000) - 20 * 60)
    const headers = new Headers({
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": svixSignature(id, timestamp, RAW),
    })
    assert.throws(
      () => verifyInboundEmailWebhookAuth({ rawBody: RAW, headers, secret: SECRET }),
      InboundEmailTimestampError,
    )
  })

  it("accepts a Bearer shared secret", () => {
    const headers = new Headers({ authorization: "Bearer inbound-secret" })
    verifyInboundEmailWebhookAuth({
      rawBody: RAW,
      headers,
      secret: "inbound-secret",
    })
  })

  it("rejects a missing Bearer when Svix headers are absent", () => {
    assert.throws(
      () =>
        verifyInboundEmailWebhookAuth({
          rawBody: RAW,
          headers: new Headers(),
          secret: "inbound-secret",
        }),
      InboundEmailMissingAuthError,
    )
  })
})
