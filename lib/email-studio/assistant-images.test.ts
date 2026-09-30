import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ASSISTANT_SCREENSHOT_MAX_BYTES,
  ASSISTANT_SCREENSHOT_MAX_COUNT,
  assistantScreenshotInstruction,
  assistantScreenshotRequest,
  assistantTranscriptContent,
  decodeAssistantScreenshots,
} from "./assistant-images"

function base64(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64")
}

function jpeg(extra = 32): number[] {
  return [0xff, 0xd8, 0xff, ...Array.from({ length: extra }, () => 0)]
}

describe("email studio assistant screenshots", () => {
  it("reads a jpeg even when the claimed type is wrong", () => {
    const decoded = decodeAssistantScreenshots([
      { mediaType: "image/png", dataBase64: base64(jpeg()) },
    ])
    assert.equal(decoded.ok, true)
    if (!decoded.ok) return
    assert.equal(decoded.images.length, 1)
    assert.equal(decoded.images[0]?.mediaType, "image/jpeg")
  })

  it("accepts a data-url prefix and png, gif, and webp signatures", () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 24 }, () => 0)]
    const gif = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...Array.from({ length: 24 }, () => 0)]
    const webp = [
      0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ...Array.from({ length: 16 }, () => 0),
    ]
    const decoded = decodeAssistantScreenshots([
      { mediaType: "image/png", dataBase64: `data:image/png;base64,${base64(png)}` },
      { mediaType: "image/gif", dataBase64: base64(gif) },
      { mediaType: "image/webp", dataBase64: base64(webp) },
    ])
    assert.equal(decoded.ok, true)
    if (!decoded.ok) return
    assert.deepEqual(
      decoded.images.map((image) => image.mediaType),
      ["image/png", "image/gif", "image/webp"],
    )
  })

  it("rejects files that are not images, oversized payloads, and too many shots", () => {
    const text = decodeAssistantScreenshots([
      { mediaType: "image/png", dataBase64: base64([0x68, 0x65, 0x6c, 0x6c, 0x6f, ...Array.from({ length: 24 }, () => 1)]) },
    ])
    assert.equal(text.ok, false)

    const huge = jpeg(ASSISTANT_SCREENSHOT_MAX_BYTES)
    const oversized = decodeAssistantScreenshots([
      { mediaType: "image/jpeg", dataBase64: base64(huge) },
    ])
    assert.equal(oversized.ok, false)

    const many = decodeAssistantScreenshots(
      Array.from({ length: ASSISTANT_SCREENSHOT_MAX_COUNT + 1 }, () => ({
        mediaType: "image/jpeg",
        dataBase64: base64(jpeg()),
      })),
    )
    assert.equal(many.ok, false)
  })

  it("writes a transcript note and a default request when the prompt is empty", () => {
    assert.equal(assistantScreenshotRequest("email", "  "), "Rebuild this email from the attached screenshot.")
    assert.equal(assistantScreenshotRequest("flow", "Add a delay"), "Add a delay")
    assert.equal(
      assistantTranscriptContent("Match this", 2),
      "Match this\n\n2 screenshots attached.",
    )
    assert.equal(
      assistantTranscriptContent("Match this", 1),
      "Match this\n\nScreenshot attached.",
    )
    assert.equal(assistantTranscriptContent("Match this", 0), "Match this")
    assert.match(assistantScreenshotInstruction(1) ?? "", /replace-document/)
    assert.equal(assistantScreenshotInstruction(0), null)
  })
})
