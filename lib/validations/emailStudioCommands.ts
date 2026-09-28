import { z } from "zod"
import { emailBlockSchema, emailStudioDocumentSchema } from "@/lib/validations/emailStudio"
import {
  emailStudioFlowDefinitionSchema,
  emailStudioFlowFilterSchema,
  emailStudioFlowStepSchema,
  emailStudioFlowTriggerSchema,
} from "@/lib/validations/emailStudioFlow"

const idSchema = z.string().uuid()
const revisionSchema = z.number().int().positive()

const emailMetaPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subject: z.string().max(200).optional(),
  previewText: z.string().max(300).optional(),
  flowName: z.string().max(200).optional(),
  flowId: z.string().max(80).optional(),
  triggerMetric: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
}).refine((patch) => Object.values(patch).some((value) => value !== undefined), {
  message: "Include at least one email field",
})

const flowMetaPatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
}).refine((patch) => Object.values(patch).some((value) => value !== undefined), {
  message: "Include at least one flow field",
})

export const emailStudioEmailSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  flowName: z.string().max(200),
  flowId: z.string().max(80),
  triggerMetric: z.string().max(120),
  notes: z.string().max(2000),
  document: emailStudioDocumentSchema,
})

export const emailStudioFlowSnapshotSchema = z.object({
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(2000),
  definition: emailStudioFlowDefinitionSchema,
})

export const emailStudioEmailCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email.meta.patch"), patch: emailMetaPatchSchema }),
  z.object({ type: z.literal("email.document.replace"), document: emailStudioDocumentSchema }),
  z.object({
    type: z.literal("email.block.insert"),
    block: emailBlockSchema,
    index: z.number().int().min(0).max(40),
  }),
  z.object({ type: z.literal("email.block.replace"), block: emailBlockSchema }),
  z.object({ type: z.literal("email.block.remove"), blockId: idSchema }),
  z.object({
    type: z.literal("email.block.move"),
    blockId: idSchema,
    toIndex: z.number().int().min(0).max(39),
  }),
])

export const emailStudioFlowCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flow.meta.patch"), patch: flowMetaPatchSchema }),
  z.object({
    type: z.literal("flow.email.create"),
    projectId: idSchema,
    name: z.string().trim().min(1).max(120),
    subject: z.string().max(200),
    previewText: z.string().max(300),
    triggerMetric: z.string().max(120),
    notes: z.string().max(2000),
    document: emailStudioDocumentSchema,
  }),
  z.object({
    type: z.literal("flow.definition.replace"),
    definition: emailStudioFlowDefinitionSchema,
  }),
  z.object({
    type: z.literal("flow.trigger.replace"),
    trigger: emailStudioFlowTriggerSchema,
  }),
  z.object({
    type: z.literal("flow.filter.replace"),
    filter: emailStudioFlowFilterSchema,
  }),
  z.object({ type: z.literal("flow.entry.set"), stepId: idSchema.nullable() }),
  z.object({
    type: z.literal("flow.step.insert"),
    step: emailStudioFlowStepSchema,
    index: z.number().int().min(0).max(40),
  }),
  z.object({ type: z.literal("flow.step.replace"), step: emailStudioFlowStepSchema }),
  z.object({ type: z.literal("flow.step.remove"), stepId: idSchema }),
  z.object({
    type: z.literal("flow.link.set"),
    fromId: idSchema,
    branch: z.enum(["next", "yes", "no"]),
    toId: idSchema.nullable(),
  }),
])

export const applyEmailStudioEmailCommandsSchema = z.object({
  scope: z.literal("email"),
  scopeId: idSchema,
  expectedRevision: revisionSchema,
  summary: z.string().trim().min(1).max(500),
  commands: z.array(emailStudioEmailCommandSchema).min(1).max(100),
})

export const applyEmailStudioFlowCommandsSchema = z.object({
  scope: z.literal("flow"),
  scopeId: idSchema,
  expectedRevision: revisionSchema,
  summary: z.string().trim().min(1).max(500),
  commands: z.array(emailStudioFlowCommandSchema).min(1).max(100),
})

export const applyEmailStudioCommandsSchema = z.discriminatedUnion("scope", [
  applyEmailStudioEmailCommandsSchema,
  applyEmailStudioFlowCommandsSchema,
])

export const emailStudioRevisionListSchema = z.object({
  scope: z.enum(["email", "flow"]),
  scopeId: idSchema,
  limit: z.number().int().min(1).max(100).optional(),
})

export const restoreEmailStudioRevisionSchema = z.object({
  scope: z.enum(["email", "flow"]),
  scopeId: idSchema,
  revision: revisionSchema,
  expectedRevision: revisionSchema,
})

export const resolveEmailStudioProposalSchema = z.object({
  proposalId: idSchema,
  decision: z.enum(["accept", "reject"]),
  expectedRevision: revisionSchema.optional(),
})

export type ApplyEmailStudioCommandsInput = z.infer<typeof applyEmailStudioCommandsSchema>
