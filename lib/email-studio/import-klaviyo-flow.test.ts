import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { importKlaviyoFlowDefinition } from "./import-klaviyo-flow"

const IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
]

describe("Klaviyo flow import", () => {
  it("maps a remote trigger, delay, and draft email into the studio graph", () => {
    let index = 0
    const imported = importKlaviyoFlowDefinition({
      definition: {
        triggers: [{ type: "metric", id: "metric-checkout" }],
        profile_filter: {
          condition_groups: [{
            conditions: [{ type: "profile-marketing-consent" }],
          }],
        },
        entry_action_id: "delay-1",
      },
      actions: [
        {
          id: "delay-1",
          actionType: "TIME_DELAY",
          definition: {
            type: "time-delay",
            links: { next: "email-1" },
            data: { unit: "hours", value: 1 },
          },
        },
        {
          id: "email-1",
          actionType: "SEND_EMAIL",
          definition: {
            type: "send-email",
            links: { next: null },
            data: {
              status: "draft",
              message: {
                template_id: "template-1",
                name: "Your cart is waiting!",
                subject_line: "Your cart is waiting!",
                preview_text: "Finish checking out",
                from_email: "hello@reswell.app",
                from_label: "Reswell",
                smart_sending_enabled: true,
              },
            },
          },
        },
      ],
      metricNames: new Map([["metric-checkout", "Checkout Started"]]),
      listNames: new Map(),
      segmentNames: new Map(),
      idFactory: () => IDS[index++] ?? crypto.randomUUID(),
    })

    assert.equal(imported.definition.trigger.type, "metric")
    if (imported.definition.trigger.type === "metric") {
      assert.equal(imported.definition.trigger.metricName, "Checkout Started")
    }
    assert.equal(imported.definition.profileFilter.type, "email-subscribed")
    assert.equal(imported.definition.steps[0]?.type, "delay")
    assert.equal(imported.definition.steps[1]?.type, "email")
    const email = imported.definition.steps[1]
    if (email?.type === "email") {
      assert.equal(email.status, "draft")
      assert.equal(email.fromEmail, "hello@reswell.app")
    }
    assert.equal(imported.emails[0]?.templateId, "template-1")
    assert.deepEqual(imported.unsupportedActions, [])
  })

  it("reports actions that cannot be edited safely", () => {
    const imported = importKlaviyoFlowDefinition({
      definition: { triggers: [], entry_action_id: "push-1" },
      actions: [{ id: "push-1", actionType: "SEND_PUSH", definition: { type: "send-push" } }],
      metricNames: new Map(),
      listNames: new Map(),
      segmentNames: new Map(),
    })
    assert.deepEqual(imported.unsupportedActions, ["SEND_PUSH"])
  })
})
