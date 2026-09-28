import { walkFlowSteps } from "./flow-definition"
import {
  removeEmailBlock,
  replaceEmailBlock,
} from "./document-tree"
import type {
  EmailStudioEmailCommand,
  EmailStudioEmailSnapshot,
  EmailStudioFlowCommand,
  EmailStudioFlowSnapshot,
  FlowLinkBranch,
} from "../types/emailStudioCommands"
import type { EmailStudioRecord } from "../types/emailStudio"
import type { EmailStudioFlowStep } from "../types/emailStudioFlow"
import type { EmailStudioFlowRecord } from "../types/emailStudioFlow"
import { emailStudioDocumentSchema } from "../validations/emailStudio"
import { emailStudioFlowDefinitionSchema } from "../validations/emailStudioFlow"

function missing(label: string): never {
  throw new Error(`${label} no longer exists.`)
}

function cloneEmailSnapshot(snapshot: EmailStudioEmailSnapshot): EmailStudioEmailSnapshot {
  return structuredClone(snapshot)
}

function cloneFlowSnapshot(snapshot: EmailStudioFlowSnapshot): EmailStudioFlowSnapshot {
  return structuredClone(snapshot)
}

export function emailStudioEmailSnapshot(record: EmailStudioRecord): EmailStudioEmailSnapshot {
  return {
    name: record.name,
    subject: record.subject,
    previewText: record.previewText,
    flowName: record.flowName,
    flowId: record.flowId,
    triggerMetric: record.triggerMetric,
    notes: record.notes,
    document: record.document,
  }
}

export function emailStudioFlowSnapshot(record: EmailStudioFlowRecord): EmailStudioFlowSnapshot {
  return {
    name: record.name,
    notes: record.notes,
    definition: record.definition,
  }
}

export function applyEmailStudioEmailCommand(
  snapshot: EmailStudioEmailSnapshot,
  command: EmailStudioEmailCommand,
): EmailStudioEmailSnapshot {
  const next = cloneEmailSnapshot(snapshot)
  if (command.type === "email.meta.patch") {
    return { ...next, ...command.patch }
  }
  if (command.type === "email.document.replace") {
    return { ...next, document: structuredClone(command.document) }
  }

  if (command.type === "email.block.replace") {
    return { ...next, document: replaceEmailBlock(next.document, structuredClone(command.block)) }
  }
  if (command.type === "email.block.remove") {
    return { ...next, document: removeEmailBlock(next.document, command.blockId) }
  }

  const blocks = [...next.document.blocks]
  if (command.type === "email.block.insert") {
    if (blocks.some((block) => block.id === command.block.id)) {
      throw new Error("That email block already exists.")
    }
    blocks.splice(Math.min(command.index, blocks.length), 0, structuredClone(command.block))
  } else {
    const index = blocks.findIndex((block) => block.id === command.blockId)
    if (index < 0) missing("That email block")
    const [block] = blocks.splice(index, 1)
    if (!block) missing("That email block")
    blocks.splice(Math.min(command.toIndex, blocks.length), 0, block)
  }
  return {
    ...next,
    document: {
      blocks,
      htmlOverride: null,
    },
  }
}

export function applyEmailStudioEmailCommands(
  snapshot: EmailStudioEmailSnapshot,
  commands: EmailStudioEmailCommand[],
): EmailStudioEmailSnapshot {
  const result = commands.reduce(applyEmailStudioEmailCommand, snapshot)
  const parsed = emailStudioDocumentSchema.safeParse(result.document)
  if (!parsed.success) throw new Error("The email changes did not fit the studio.")
  return { ...result, document: parsed.data }
}

function assertStepExists(steps: EmailStudioFlowStep[], id: string | null): void {
  if (id && !steps.some((step) => step.id === id)) missing("That flow action")
}

function patchLink(
  step: EmailStudioFlowStep,
  branch: FlowLinkBranch,
  toId: string | null,
): EmailStudioFlowStep {
  if (step.type === "split") {
    if (branch === "next") throw new Error("A split connects through its yes or no path.")
    return branch === "yes" ? { ...step, yes: toId } : { ...step, no: toId }
  }
  if (branch !== "next") throw new Error("Only a split has yes and no paths.")
  return { ...step, next: toId }
}

function removeStepReferences(
  step: EmailStudioFlowStep,
  removedId: string,
): EmailStudioFlowStep {
  if (step.type === "split") {
    return {
      ...step,
      yes: step.yes === removedId ? null : step.yes,
      no: step.no === removedId ? null : step.no,
    }
  }
  return { ...step, next: step.next === removedId ? null : step.next }
}

export function applyEmailStudioFlowCommand(
  snapshot: EmailStudioFlowSnapshot,
  command: EmailStudioFlowCommand,
): EmailStudioFlowSnapshot {
  const next = cloneFlowSnapshot(snapshot)
  if (command.type === "flow.meta.patch") {
    return { ...next, ...command.patch }
  }
  if (command.type === "flow.email.create") {
    return next
  }
  if (command.type === "flow.definition.replace") {
    return { ...next, definition: structuredClone(command.definition) }
  }
  if (command.type === "flow.trigger.replace") {
    return { ...next, definition: { ...next.definition, trigger: structuredClone(command.trigger) } }
  }
  if (command.type === "flow.filter.replace") {
    return { ...next, definition: { ...next.definition, profileFilter: structuredClone(command.filter) } }
  }
  if (command.type === "flow.entry.set") {
    assertStepExists(next.definition.steps, command.stepId)
    return { ...next, definition: { ...next.definition, entryStepId: command.stepId } }
  }

  let steps = [...next.definition.steps]
  let entryStepId = next.definition.entryStepId
  if (command.type === "flow.step.insert") {
    if (steps.some((step) => step.id === command.step.id)) {
      throw new Error("That flow action already exists.")
    }
    steps.splice(Math.min(command.index, steps.length), 0, structuredClone(command.step))
  } else if (command.type === "flow.step.replace") {
    const index = steps.findIndex((step) => step.id === command.step.id)
    if (index < 0) missing("That flow action")
    steps[index] = structuredClone(command.step)
  } else if (command.type === "flow.step.remove") {
    if (!steps.some((step) => step.id === command.stepId)) missing("That flow action")
    steps = steps
      .filter((step) => step.id !== command.stepId)
      .map((step) => removeStepReferences(step, command.stepId))
    if (entryStepId === command.stepId) entryStepId = null
  } else {
    assertStepExists(steps, command.toId)
    const index = steps.findIndex((step) => step.id === command.fromId)
    if (index < 0) missing("That flow action")
    const step = steps[index]
    if (!step) missing("That flow action")
    steps[index] = patchLink(step, command.branch, command.toId)
  }
  return { ...next, definition: { ...next.definition, entryStepId, steps } }
}

export function validateEmailStudioFlowSnapshot(
  snapshot: EmailStudioFlowSnapshot,
): EmailStudioFlowSnapshot {
  const parsed = emailStudioFlowDefinitionSchema.safeParse(snapshot.definition)
  if (!parsed.success) throw new Error("The flow changes did not fit the studio.")
  const ids = parsed.data.steps.map((step) => step.id)
  if (new Set(ids).size !== ids.length) throw new Error("Every flow action needs a unique id.")
  for (const step of parsed.data.steps) {
    if (step.type === "split") {
      assertStepExists(parsed.data.steps, step.yes)
      assertStepExists(parsed.data.steps, step.no)
    } else {
      assertStepExists(parsed.data.steps, step.next)
    }
  }
  const reachable = walkFlowSteps(parsed.data)
  if (reachable.length !== parsed.data.steps.length) {
    throw new Error("Every flow action must be connected to the trigger.")
  }
  return { ...snapshot, definition: parsed.data }
}

export function applyEmailStudioFlowCommands(
  snapshot: EmailStudioFlowSnapshot,
  commands: EmailStudioFlowCommand[],
): EmailStudioFlowSnapshot {
  return validateEmailStudioFlowSnapshot(commands.reduce(applyEmailStudioFlowCommand, snapshot))
}

export function emailSnapshotRestoreCommands(
  snapshot: EmailStudioEmailSnapshot,
): EmailStudioEmailCommand[] {
  const { document, ...patch } = cloneEmailSnapshot(snapshot)
  return [
    { type: "email.meta.patch", patch },
    { type: "email.document.replace", document },
  ]
}

export function flowSnapshotRestoreCommands(
  snapshot: EmailStudioFlowSnapshot,
): EmailStudioFlowCommand[] {
  const { definition, ...patch } = cloneFlowSnapshot(snapshot)
  return [
    { type: "flow.meta.patch", patch },
    { type: "flow.definition.replace", definition },
  ]
}
