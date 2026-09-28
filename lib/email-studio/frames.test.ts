import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { documentForFlowEmail } from "./assistant-draft"
import {
  EMAIL_STUDIO_FRAMES,
  composeDesignedEmail,
  createEmailFrame,
  designFlatEmailDocument,
  inferEmailDesignLayout,
} from "./frames"
import { emailStudioDocumentSchema } from "@/lib/validations/emailStudio"

describe("email studio frames", () => {
  it("builds a schema-valid block for every frame", () => {
    for (const frame of EMAIL_STUDIO_FRAMES) {
      const block = createEmailFrame(frame.id)
      const parsed = emailStudioDocumentSchema.safeParse({
        blocks: [block],
        htmlOverride: null,
      })
      assert.equal(parsed.success, true, frame.id)
    }
    const features = createEmailFrame("features")
    assert.equal(features.type, "section")
    if (features.type === "section") assert.equal(features.columns.length, 3)
    const receipt = createEmailFrame("receipt")
    assert.equal(receipt.type, "details")
  })

  it("turns a flat stack into a designed email and leaves a section layout alone", () => {
    assert.equal(inferEmailDesignLayout("Your order shipped"), "transactional")
    const flat = designFlatEmailDocument({
      blocks: [
        { id: crypto.randomUUID(), type: "heading", text: "Your order shipped", align: "left" },
        { id: crypto.randomUUID(), type: "text", text: "The seller dropped it off.", align: "left" },
        { id: crypto.randomUUID(), type: "button", label: "Track it", href: "https://www.reswell.app", align: "center" },
      ],
    })
    assert.equal(flat.blocks.some((block) => block.type === "section"), true)
    assert.equal(flat.blocks.some((block) => block.type === "details"), true)
    assert.equal(emailStudioDocumentSchema.safeParse(flat).success, true)

    const designed = composeDesignedEmail({
      layout: "announcement",
      heading: "Welcome",
      body: "You have an account.",
      buttonLabel: "Open Reswell",
      buttonHref: "https://www.reswell.app",
    })
    const kept = designFlatEmailDocument(designed)
    assert.equal(kept.blocks.filter((block) => block.type === "section").length, designed.blocks.filter((block) => block.type === "section").length)
  })

  it("designs a flow email instead of a plain paragraph stack", () => {
    const document = documentForFlowEmail({
      layout: "editorial",
      eyebrow: "Welcome",
      heading: "You are in",
      body: "Start with the boards that are already listed.",
      buttonLabel: "Browse",
      buttonHref: "https://www.reswell.app",
    })
    assert.equal(document.blocks[0]?.type, "logo")
    assert.equal(document.blocks.some((block) => block.type === "section"), true)
    assert.equal(document.blocks.at(-1)?.type, "footer")
    assert.equal(emailStudioDocumentSchema.safeParse(document).success, true)
  })
})
