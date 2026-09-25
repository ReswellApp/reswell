import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { compileKlaviyoFlow } from "./compile-klaviyo-flow.ts"
import { walkFlowSteps } from "./flow-definition.ts"
import type { EmailStudioFlowDefinition } from "@/lib/types/emailStudioFlow"

const PROJECT = "11111111-1111-4111-8111-111111111111"
const DELAY = "22222222-2222-4222-8222-222222222222"
const EMAIL = "33333333-3333-4333-8333-333333333333"

function definition(): EmailStudioFlowDefinition {
  return {
    trigger: { type: "metric", metricId: "WetyVq", metricName: "Placed Order" },
    profileFilter: { type: "email-subscribed" },
    entryStepId: DELAY,
    steps: [
      { id: DELAY, type: "delay", unit: "hours", value: 1, next: EMAIL },
      {
        id: EMAIL,
        type: "email",
        projectId: PROJECT,
        fromEmail: "hayden@reswell.app",
        fromLabel: "Reswell",
        smartSending: true,
        transactional: false,
        next: null,
      },
    ],
  }
}

describe("compile klaviyo flow", () => {
  it("builds a metric trigger, consent filter, delay, and email", () => {
    const compiled = compileKlaviyoFlow({
      name: "Welcome",
      definition: definition(),
      templateIds: new Map([[PROJECT, "tmpl_1"]]),
      subjects: new Map([[PROJECT, { subject: "Hello", preview: "There", name: "Hello email" }]]),
    })
    assert.equal(compiled.definition.entry_action_id, DELAY)
    const triggers = compiled.definition.triggers as { type: string; id: string }[]
    assert.equal(triggers[0]?.type, "metric")
    assert.equal(triggers[0]?.id, "WetyVq")
    const actions = compiled.definition.actions as { type: string }[]
    assert.deepEqual(actions.map((action) => action.type), ["time-delay", "send-email"])
    assert.equal(compiled.emails.length, 1)
  })

  it("refuses an email that has not been pushed", () => {
    assert.throws(
      () =>
        compileKlaviyoFlow({
          name: "Welcome",
          definition: definition(),
          templateIds: new Map(),
          subjects: new Map(),
        }),
      /Push each email/,
    )
  })

  it("rejects a loop and allows a split", () => {
    const loop = definition()
    loop.steps[1] = { id: EMAIL, type: "delay", unit: "days", value: 1, next: DELAY }
    assert.throws(() => walkFlowSteps(loop), /loops/)

    const yes = "44444444-4444-4444-8444-444444444444"
    const split: EmailStudioFlowDefinition = {
      ...definition(),
      entryStepId: yes,
      steps: [
        {
          id: yes,
          type: "split",
          mode: "email-subscribed",
          property: "",
          operator: "equals",
          value: "",
          yes: EMAIL,
          no: null,
        },
        definition().steps[1]!,
      ],
    }
    const compiled = compileKlaviyoFlow({
      name: "Split",
      definition: split,
      templateIds: new Map([[PROJECT, "tmpl_1"]]),
      subjects: new Map([[PROJECT, { subject: "Hi", preview: "", name: "Hi" }]]),
    })
    const actions = compiled.definition.actions as { type: string }[]
    assert.equal(actions[0]?.type, "conditional-split")
  })
})
