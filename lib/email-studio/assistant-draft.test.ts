import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assistantWantsFlow,
  coerceAssistantBlocks,
  coerceAssistantEmail,
  coerceAssistantFlow,
  coerceAssistantStudio,
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

  it("nests yes and no steps under a split and keeps the next main step", () => {
    const flow = coerceAssistantFlow({
      name: "Branch",
      steps: [
        { type: "split", splitMode: "email-subscribed", branch: "main" },
        { type: "email", branch: "yes", subject: "Yes", heading: "In", body: "Yes" },
        { type: "sms", branch: "no", smsBody: "No" },
        { type: "delay", branch: "main", unit: "days", value: 2 },
      ],
    })
    assert.ok(flow)
    assert.equal(flow.steps[0]?.type, "split")
    const split = flow.steps[0]
    assert.equal(split?.type, "split")
    if (split?.type === "split") {
      assert.equal(split.yes[0]?.type, "email")
      assert.equal(split.no[0]?.type, "sms")
    }
    assert.equal(flow.steps[1]?.type, "delay")
  })

  it("applies an email and a flow from one object, and skips a side marked no", () => {
    const both = coerceAssistantStudio({
      reply: "Both.",
      applyEmail: "yes",
      applyFlow: "yes",
      subject: "Hello",
      blocks: [{ type: "heading", text: "Hi" }],
      flowName: "Welcome",
      steps: [{ type: "email", subject: "Welcome", heading: "In", body: "Start" }],
    })
    assert.ok(both?.email)
    assert.equal(both.email.subject, "Hello")
    assert.equal(both.flow?.name, "Welcome")
    assert.equal(both.flow?.steps[0]?.type, "email")

    const emailOnly = coerceAssistantStudio({
      applyEmail: "yes",
      applyFlow: "no",
      blocks: [{ type: "text", text: "Hi" }],
      steps: [{ type: "delay", value: 1, unit: "days" }],
    })
    assert.ok(emailOnly?.email)
    assert.equal(emailOnly.flow, null)
  })
})
