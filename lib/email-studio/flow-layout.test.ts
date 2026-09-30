import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { layoutEmailStudioFlow } from "./flow-layout"
import type { EmailStudioFlowDefinition } from "@/lib/types/emailStudioFlow"

const DELAY = "11111111-1111-4111-8111-111111111111"
const SPLIT = "22222222-2222-4222-8222-222222222222"
const YES = "33333333-3333-4333-8333-333333333333"
const NO = "44444444-4444-4444-8444-444444444444"
const REJOIN = "55555555-5555-4555-8555-555555555555"

function definition(): EmailStudioFlowDefinition {
  return {
    trigger: { type: "metric", metricId: "metric", metricName: "Placed Order" },
    profileFilter: { type: "email-subscribed" },
    entryStepId: DELAY,
    steps: [
      { id: DELAY, type: "delay", unit: "hours", value: 1, next: SPLIT },
      {
        id: SPLIT,
        type: "split",
        mode: "email-subscribed",
        property: "",
        operator: "equals",
        value: "",
        yes: YES,
        no: NO,
      },
      { id: YES, type: "sms", body: "Yes", smartSending: true, next: null },
      { id: NO, type: "sms", body: "No", smartSending: true, next: null },
    ],
  }
}

describe("email studio flow layout", () => {
  it("places the trigger above actions and branches side by side", () => {
    const layout = layoutEmailStudioFlow(definition())
    const trigger = layout.nodes.find((node) => node.id === "trigger")
    const delay = layout.nodes.find((node) => node.id === DELAY)
    const yes = layout.nodes.find((node) => node.id === YES)
    const no = layout.nodes.find((node) => node.id === NO)
    assert.ok(trigger && delay && yes && no)
    assert.ok(trigger.y < delay.y)
    assert.equal(yes.y, no.y)
    assert.notEqual(yes.x, no.x)
    assert.deepEqual(
      layout.edges.filter((edge) => edge.from === SPLIT).map((edge) => edge.label).sort(),
      ["No", "Yes"],
    )
  })

  it("keeps disconnected actions visible for repair", () => {
    const broken = definition()
    broken.steps.push({
      id: REJOIN,
      type: "delay",
      unit: "days",
      value: 2,
      next: null,
    })
    const layout = layoutEmailStudioFlow(broken)
    assert.equal(layout.nodes.length, 6)
  })

  it("places a rejoined continuation below both branch actions", () => {
    const rejoined = definition()
    const yes = rejoined.steps.find((step) => step.id === YES)
    const no = rejoined.steps.find((step) => step.id === NO)
    if (yes?.type === "sms") yes.next = REJOIN
    if (no?.type === "sms") no.next = REJOIN
    rejoined.steps.push({ id: REJOIN, type: "delay", unit: "days", value: 1, next: null })
    const layout = layoutEmailStudioFlow(rejoined)
    const yesNode = layout.nodes.find((node) => node.id === YES)
    const noNode = layout.nodes.find((node) => node.id === NO)
    const continuation = layout.nodes.find((node) => node.id === REJOIN)
    assert.ok(yesNode && noNode && continuation)
    assert.ok(continuation.y > yesNode.y)
    assert.ok(continuation.y > noNode.y)
  })

  it("adds action insertion points at empty entries, branches, and path ends", () => {
    const empty = definition()
    empty.entryStepId = null
    empty.steps = []
    assert.deepEqual(layoutEmailStudioFlow(empty).insertionPoints.map((point) => point.anchor), [
      { kind: "entry" },
    ])

    const flow = definition()
    const split = flow.steps.find((step) => step.id === SPLIT)
    if (split?.type === "split") split.no = null
    const insertionPoints = layoutEmailStudioFlow(flow).insertionPoints
    assert.ok(insertionPoints.some((point) => point.anchor.kind === "no"))
    assert.ok(insertionPoints.some((point) => point.anchor.kind === "next"))
  })
})
