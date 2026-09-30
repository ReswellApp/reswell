import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildStructuredEmailBrief,
  RESWELL_EMAIL_VOICE_PROMPT,
} from "./reswell-email-voice"

describe("Reswell email voice", () => {
  it("keeps the structured brief explicit and marks an empty offer as absent", () => {
    const brief = buildStructuredEmailBrief({
      objective: " Feature new boards ",
      audience: " Mid-length shoppers ",
      emailType: "Product spotlight",
      productsOrCategory: " 7–8 foot mid-lengths ",
      offer: " ",
      tone: "Calm and direct",
      primaryCta: "Browse mid-lengths — https://www.reswell.app/boards",
    })

    assert.match(brief, /Objective: Feature new boards/)
    assert.match(brief, /Audience: Mid-length shoppers/)
    assert.match(brief, /Offer: None/)
    assert.match(brief, /Do not fill missing product or offer details with guesses/)
  })

  it("instructs the model to stay plainspoken and factual", () => {
    assert.match(RESWELL_EMAIL_VOICE_PROMPT, /calm, direct, warm/)
    assert.match(RESWELL_EMAIL_VOICE_PROMPT, /Never invent inventory/)
    assert.match(RESWELL_EMAIL_VOICE_PROMPT, /Avoid clichés and hype/)
  })
})
