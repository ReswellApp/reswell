import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildIndexNowSubmission, readIndexNowKey } from "./indexnow.ts"

describe("IndexNow", () => {
  it("accepts an 8–128 character key and rejects everything else", () => {
    assert.equal(readIndexNowKey("abcd1234"), "abcd1234")
    assert.equal(readIndexNowKey("  abcd-1234  "), "abcd-1234")
    assert.equal(readIndexNowKey("short"), null)
    assert.equal(readIndexNowKey("has space1"), null)
    assert.equal(readIndexNowKey(""), null)
    assert.equal(readIndexNowKey(undefined), null)
  })

  it("builds a same-host submission for listing URLs", () => {
    const submission = buildIndexNowSubmission({
      origin: "https://www.reswell.app",
      key: "reswellindexnowkey",
      urls: ["https://www.reswell.app/l/ci-twin-pin", "https://www.reswell.app/l/ci-twin-pin"],
    })
    assert.ok(submission)
    assert.equal(submission.body.host, "www.reswell.app")
    assert.equal(submission.body.keyLocation, "https://www.reswell.app/indexnow-key.txt")
    assert.deepEqual(submission.body.urlList, ["https://www.reswell.app/l/ci-twin-pin"])
  })
})
