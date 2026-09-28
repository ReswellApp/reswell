import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyEmailStudioEmailCommands,
  applyEmailStudioFlowCommands,
  emailSnapshotRestoreCommands,
  flowSnapshotRestoreCommands,
} from "./commands"
import type {
  EmailStudioEmailSnapshot,
  EmailStudioFlowSnapshot,
} from "@/lib/types/emailStudioCommands"

const BLOCK_A = "11111111-1111-4111-8111-111111111111"
const BLOCK_B = "22222222-2222-4222-8222-222222222222"
const STEP_A = "33333333-3333-4333-8333-333333333333"
const STEP_B = "44444444-4444-4444-8444-444444444444"

function emailSnapshot(): EmailStudioEmailSnapshot {
  return {
    name: "Welcome",
    subject: "Hello",
    previewText: "Welcome to Reswell",
    flowName: "",
    flowId: "",
    triggerMetric: "New Account Created",
    notes: "",
    document: {
      blocks: [
        { id: BLOCK_A, type: "heading", text: "Welcome", align: "left" },
      ],
      htmlOverride: "<p>old</p>",
    },
  }
}

function flowSnapshot(): EmailStudioFlowSnapshot {
  return {
    name: "Welcome flow",
    notes: "",
    definition: {
      trigger: { type: "metric", metricId: "metric_1", metricName: "New Account Created" },
      profileFilter: { type: "email-subscribed" },
      entryStepId: STEP_A,
      steps: [
        { id: STEP_A, type: "delay", unit: "hours", value: 1, next: STEP_B },
        {
          id: STEP_B,
          type: "email",
          projectId: BLOCK_A,
          fromEmail: "hello@reswell.app",
          fromLabel: "Reswell",
          smartSending: true,
          transactional: false,
          next: null,
        },
      ],
    },
  }
}

describe("email studio commands", () => {
  it("applies granular email edits and clears custom HTML", () => {
    const result = applyEmailStudioEmailCommands(emailSnapshot(), [
      {
        type: "email.block.insert",
        index: 1,
        block: { id: BLOCK_B, type: "text", text: "Find your next board.", align: "left" },
      },
      { type: "email.block.move", blockId: BLOCK_B, toIndex: 0 },
      { type: "email.meta.patch", patch: { subject: "Your Reswell account is ready" } },
    ])

    assert.equal(result.subject, "Your Reswell account is ready")
    assert.deepEqual(result.document.blocks.map((block) => block.id), [BLOCK_B, BLOCK_A])
    assert.equal(result.document.htmlOverride, null)
  })

  it("restores an email snapshot with commands", () => {
    const original = emailSnapshot()
    const changed = applyEmailStudioEmailCommands(original, [
      { type: "email.meta.patch", patch: { subject: "Changed" } },
      { type: "email.block.remove", blockId: BLOCK_A },
    ])
    const restored = applyEmailStudioEmailCommands(changed, emailSnapshotRestoreCommands(original))
    assert.deepEqual(restored, original)
  })

  it("replaces a selected layer inside a section without replacing the section", () => {
    const original = emailSnapshot()
    original.document = {
      blocks: [
        {
          id: BLOCK_A,
          type: "section",
          surface: "muted",
          padding: "comfortable",
          gap: "comfortable",
          stackOnMobile: true,
          columns: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              width: 1,
              blocks: [
                { id: BLOCK_B, type: "heading", text: "Before", align: "left" },
              ],
            },
          ],
        },
      ],
    }
    const result = applyEmailStudioEmailCommands(original, [
      {
        type: "email.block.replace",
        block: { id: BLOCK_B, type: "heading", text: "After", align: "center" },
      },
    ])
    const section = result.document.blocks[0]
    assert.equal(section?.type, "section")
    if (section?.type === "section") {
      assert.equal(section.columns[0]?.blocks[0]?.type, "heading")
      const heading = section.columns[0]?.blocks[0]
      if (heading?.type === "heading") assert.equal(heading.text, "After")
    }
  })

  it("applies flow links and validates reachability", () => {
    const original = flowSnapshot()
    const result = applyEmailStudioFlowCommands(original, [
      { type: "flow.link.set", fromId: STEP_A, branch: "next", toId: null },
      { type: "flow.entry.set", stepId: STEP_B },
      { type: "flow.step.remove", stepId: STEP_A },
    ])
    assert.equal(result.definition.entryStepId, STEP_B)
    assert.deepEqual(result.definition.steps.map((step) => step.id), [STEP_B])
  })

  it("rejects a disconnected flow action", () => {
    const original = flowSnapshot()
    assert.throws(
      () => applyEmailStudioFlowCommands(original, [
        { type: "flow.link.set", fromId: STEP_A, branch: "next", toId: null },
      ]),
      /connected to the trigger/,
    )
  })

  it("restores a flow snapshot with commands", () => {
    const original = flowSnapshot()
    const changed = applyEmailStudioFlowCommands(original, [
      { type: "flow.meta.patch", patch: { name: "Changed flow" } },
      {
        type: "flow.step.replace",
        step: { id: STEP_A, type: "delay", unit: "days", value: 2, next: STEP_B },
      },
    ])
    const restored = applyEmailStudioFlowCommands(changed, flowSnapshotRestoreCommands(original))
    assert.deepEqual(restored, original)
  })

  it("keeps resource-creation commands out of the flow graph reducer", () => {
    const original = flowSnapshot()
    const result = applyEmailStudioFlowCommands(original, [
      {
        type: "flow.email.create",
        projectId: "55555555-5555-4555-8555-555555555555",
        name: "Follow-up",
        subject: "Still looking?",
        previewText: "",
        triggerMetric: "New Account Created",
        notes: "",
        document: { blocks: [] },
      },
    ])
    assert.deepEqual(result, original)
  })
})
