import { z } from "zod"
import {
  FLOW_DATE_UNITS,
  FLOW_DELAY_UNITS,
  FLOW_RECURRENCE,
  FLOW_STRING_OPERATORS,
} from "@/lib/types/emailStudioFlow"

const idSchema = z.string().uuid()
const nextSchema = idSchema.nullable()

const triggerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("metric"),
    metricId: z.string().max(80),
    metricName: z.string().max(200),
  }),
  z.object({
    type: z.literal("list"),
    listId: z.string().max(80),
    listName: z.string().max(200),
  }),
  z.object({
    type: z.literal("segment"),
    segmentId: z.string().max(80),
    segmentName: z.string().max(200),
  }),
  z.object({
    type: z.literal("profile-date"),
    property: z.string().trim().min(1).max(120),
    beforeUnit: z.enum(FLOW_DATE_UNITS),
    beforeValue: z.number().int().min(0).max(365),
    recurrence: z.enum(FLOW_RECURRENCE),
  }),
])

const filterSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("email-subscribed") }),
  z.object({
    type: z.literal("property-equals"),
    property: z.string().trim().min(1).max(120),
    value: z.string().max(500),
  }),
])

const stepSchema = z.discriminatedUnion("type", [
  z.object({
    id: idSchema,
    type: z.literal("delay"),
    unit: z.enum(FLOW_DELAY_UNITS),
    value: z.number().int().min(1).max(365),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("email"),
    projectId: z.union([z.string().uuid(), z.literal("")]),
    fromEmail: z.string().max(200),
    fromLabel: z.string().trim().min(1).max(80),
    smartSending: z.boolean(),
    transactional: z.boolean(),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("sms"),
    body: z.string().max(1600),
    smartSending: z.boolean(),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("webhook"),
    url: z.string().max(2000),
    body: z.string().max(8000),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("update-profile"),
    property: z.string().trim().min(1).max(120),
    value: z.string().max(500),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("list-update"),
    listId: z.string().trim().min(1).max(80),
    add: z.boolean(),
    next: nextSchema,
  }),
  z.object({
    id: idSchema,
    type: z.literal("split"),
    mode: z.enum(["profile-property", "email-subscribed", "event-property"]),
    property: z.string().max(120),
    operator: z.enum(FLOW_STRING_OPERATORS),
    value: z.string().max(500),
    yes: nextSchema,
    no: nextSchema,
  }),
])

export const emailStudioFlowDefinitionSchema = z.object({
  trigger: triggerSchema,
  profileFilter: filterSchema,
  entryStepId: nextSchema,
  steps: z.array(stepSchema).max(40),
})

export const createEmailStudioFlowSchema = z.object({
  name: z.string().trim().min(1, "Name the flow").max(120),
})

export const updateEmailStudioFlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  notes: z.string().max(2000),
  definition: emailStudioFlowDefinitionSchema,
})

export const emailStudioFlowIdSchema = z.object({
  id: z.string().uuid(),
})

export const setEmailStudioFlowStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["draft", "manual", "live"]),
  confirmLive: z.boolean().optional(),
})

export const pushEmailStudioFlowSchema = z.object({
  id: z.string().uuid(),
  /** When the flow was already pushed, create a new Klaviyo draft instead of refusing. */
  replace: z.boolean().optional(),
})

export type UpdateEmailStudioFlowInput = z.infer<typeof updateEmailStudioFlowSchema>
