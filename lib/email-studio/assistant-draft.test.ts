import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assistantWantsFlow,
  coerceAssistantBlocks,
  coerceAssistantEmail,
  coerceAssistantFlow,
  extractJsonObject,
} from "./assistant-draft"

describe("email studio assistant drafts", () => {
  it("treats an email rewrite as an email, and a delay as a flow", () => {
    assert.equal(assistantWantsFlow("email", "Make the headline shorter"), false)
    assert.equal(assistantWantsFlow("email", "Build a flow with a 1 day delay"), true)
    assert.equal(assistantWantsFlow("flow", "Make the headline shorter"), true)
  })

  it("reads a fenced JSON object", () => {
    const parsed = extractJsonObject('Sure\n```json\n{"subject":"Hi"}\n```')
    assert.deepEqual(parsed, { subject: "Hi" })
  })

  it("turns a loose block list into a studio document", () => {
    const email = coerceAssistantEmail({
      reply: "Shortened the headline.",
      subject: "Your board sold",
      previewText: "Open the sale",
      blocks: [
        { type: "headline", text: "It sold", align: "left" },
        { type: "paragraph", text: "Hey {{ first_name|default:'there' }}.", align: "left" },
        { type: "cta", label: "View sale", href: "https://www.reswell.app" },
      ],
    })
    assert.ok(email)
    assert.equal(email.draft.subject, "Your board sold")
    assert.equal(email.draft.document.blocks[0]?.type, "logo")
    assert.equal(email.draft.document.blocks.at(-1)?.type, "footer")
    const types = email.draft.document.blocks.map((block) => block.type)
    assert.ok(types.includes("heading"))
    assert.ok(types.includes("button"))
  })

  it("drops unknown blocks and still returns a document", () => {
    const blocks = coerceAssistantBlocks([{ type: "nope" }, { type: "heading", text: "Hello" }])
    assert.equal(blocks.some((block) => block.type === "heading"), true)
  })

  it("builds a linear flow from loose step names", () => {
    const flow = coerceAssistantFlow({
      name: "Welcome",
      triggerType: "metric",
      triggerName: "New Account Created",
      steps: [
        { type: "wait", unit: "hours", value: 1 },
        { type: "email", subject: "Welcome", heading: "You are in", body: "Start on Reswell." },
      ],
    })
    assert.ok(flow)
    assert.equal(flow.steps[0]?.type, "delay")
    assert.equal(flow.steps[1]?.type, "email")
  })
})
