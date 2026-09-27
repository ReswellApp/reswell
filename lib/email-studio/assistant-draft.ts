import { z } from "zod"
import type { EmailAlign, EmailBlock, EmailStudioDocument } from "@/lib/types/emailStudio"
import { emailStudioDocumentSchema } from "@/lib/validations/emailStudio"
import { RESWELL_EMAIL_HOME, RESWELL_EMAIL_LOGO } from "@/lib/email-studio/document"

const BLOCK_TYPES = [
  "logo",
  "eyebrow",
  "heading",
  "text",
  "image",
  "button",
  "split",
  "details",
  "divider",
  "spacer",
  "footer",
] as const

type BlockType = (typeof BLOCK_TYPES)[number]

const blockModelSchema = z.object({
  type: z.enum(BLOCK_TYPES),
  text: z.string().max(8000),
  align: z.enum(["left", "center"]),
  href: z.string().max(2000),
  src: z.string().max(2000),
  alt: z.string().max(500),
  label: z.string().max(500),
  title: z.string().max(500),
  buttonLabel: z.string().max(500),
  buttonHref: z.string().max(2000),
  imageSrc: z.string().max(2000),
  imageAlt: z.string().max(500),
  showUnsubscribe: z.boolean(),
  height: z.number(),
  rows: z.array(z.object({ label: z.string().max(200), value: z.string().max(500) })).max(8),
})

export const assistantEmailModelSchema = z.object({
  reply: z.string().max(2000),
  name: z.string().max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  notes: z.string().max(2000),
  blocks: z.array(blockModelSchema).min(1).max(16),
})

const stepTypes = ["delay", "email", "sms", "webhook", "update-profile", "list-update", "split"] as const

const flowStepModelSchema = z.object({
  type: z.enum(stepTypes),
  branch: z.enum(["main", "yes", "no"]),
  unit: z.enum(["minutes", "hours", "days"]),
  value: z.number(),
  name: z.string().max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  heading: z.string().max(500),
  body: z.string().max(8000),
  buttonLabel: z.string().max(500),
  buttonHref: z.string().max(2000),
  smsBody: z.string().max(1600),
  url: z.string().max(2000),
  property: z.string().max(120),
  propertyValue: z.string().max(500),
  listId: z.string().max(80),
  add: z.boolean(),
  splitMode: z.enum(["profile-property", "email-subscribed", "event-property"]),
  operator: z.enum(["equals", "contains", "not-equals"]),
  splitValue: z.string().max(500),
})

const flowFields = {
  triggerType: z.enum(["metric", "list", "segment", "profile-date"]),
  triggerId: z.string().max(80),
  triggerName: z.string().max(200),
  dateProperty: z.string().max(120),
  dateBeforeUnit: z.enum(["days", "weeks", "months"]),
  dateBeforeValue: z.number(),
  recurrence: z.enum(["never", "annually", "monthly", "weekly"]),
  filterType: z.enum(["none", "email-subscribed", "property-equals"]),
  filterProperty: z.string().max(120),
  filterValue: z.string().max(500),
}

export const assistantFlowModelSchema = z.object({
  reply: z.string().max(2000),
  name: z.string().max(120),
  notes: z.string().max(2000),
  ...flowFields,
  steps: z.array(flowStepModelSchema).min(1).max(12),
})

/** One draft for an email, a flow, or both. Empty lists mean that side is unchanged. */
export const assistantStudioModelSchema = z.object({
  reply: z.string().max(2000),
  applyEmail: z.enum(["yes", "no"]),
  applyFlow: z.enum(["yes", "no"]),
  name: z.string().max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  notes: z.string().max(2000),
  blocks: z.array(blockModelSchema).max(16),
  flowName: z.string().max(120),
  flowNotes: z.string().max(2000),
  ...flowFields,
  steps: z.array(flowStepModelSchema).max(12),
})

export type AssistantEmailModel = z.infer<typeof assistantEmailModelSchema>
export type AssistantFlowModel = z.infer<typeof assistantFlowModelSchema>

export type AssistantEmailDraft = {
  name: string
  subject: string
  previewText: string
  notes: string
  document: EmailStudioDocument
}

export function assistantWantsFlow(scope: "email" | "flow", message: string): boolean {
  if (scope === "flow") return true
  return /\b(flows?|delays?|triggers?|sequence|drip|webhook|sms|wait\s+\d+)\b/i.test(message)
}

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced?.[1] ?? text
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function textOf(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function alignOf(value: unknown): EmailAlign {
  return value === "center" ? "center" : "left"
}

function blockTypeOf(value: unknown): BlockType | null {
  const raw = textOf(value, 40).toLowerCase()
  if ((BLOCK_TYPES as readonly string[]).includes(raw)) return raw as BlockType
  if (raw === "headline" || raw === "title") return "heading"
  if (raw === "body" || raw === "paragraph" || raw === "copy") return "text"
  if (raw === "cta") return "button"
  if (raw === "hero") return "image"
  return null
}

function blockFromRow(row: Record<string, unknown>): EmailBlock | null {
  const type = blockTypeOf(row.type)
  if (!type) return null
  const id = crypto.randomUUID()
  const text = textOf(row.text, 8000)
  const align = alignOf(row.align)
  if (type === "logo") {
    return {
      id,
      type,
      src: RESWELL_EMAIL_LOGO,
      alt: "Reswell",
      href: RESWELL_EMAIL_HOME,
      width: 140,
    }
  }
  if (type === "eyebrow" || type === "heading" || type === "text") {
    return { id, type, text: text || (type === "heading" ? "Hello" : "Reswell"), align }
  }
  if (type === "image") {
    return {
      id,
      type,
      src: textOf(row.src, 2000),
      alt: textOf(row.alt, 500),
      href: textOf(row.href, 2000),
      width: 560,
      height: null,
    }
  }
  if (type === "button") {
    return {
      id,
      type,
      label: textOf(row.label, 500) || textOf(row.text, 500) || "Open Reswell",
      href: textOf(row.href, 2000) || RESWELL_EMAIL_HOME,
      align,
    }
  }
  if (type === "split") {
    return {
      id,
      type,
      imageSrc: textOf(row.imageSrc, 2000) || textOf(row.src, 2000),
      imageAlt: textOf(row.imageAlt, 500) || textOf(row.alt, 500),
      imageHref: "",
      imageWidth: 240,
      imageHeight: null,
      title: textOf(row.title, 500) || "Listing",
      text: text || "Open it on Reswell.",
      buttonLabel: textOf(row.buttonLabel, 500) || "View",
      buttonHref: textOf(row.buttonHref, 2000) || textOf(row.href, 2000) || RESWELL_EMAIL_HOME,
    }
  }
  if (type === "details") {
    const rows = Array.isArray(row.rows) ? row.rows : []
    const parsed = rows.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const record = item as Record<string, unknown>
      return [{ id: crypto.randomUUID(), label: textOf(record.label, 500), value: textOf(record.value, 2000) }]
    }).slice(0, 12)
    return { id, type, title: textOf(row.title, 500) || "Details", rows: parsed }
  }
  if (type === "divider") return { id, type }
  if (type === "spacer") {
    const height = Number(row.height)
    return { id, type, height: Number.isFinite(height) ? Math.min(80, Math.max(8, Math.round(height))) : 24 }
  }
  return { id, type, text: text || "Reswell — the marketplace for used surf gear.", showUnsubscribe: row.showUnsubscribe !== false }
}

export function coerceAssistantBlocks(raw: unknown): EmailBlock[] {
  if (!Array.isArray(raw)) return []
  const blocks = raw.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const block = blockFromRow(item as Record<string, unknown>)
    return block ? [block] : []
  }).slice(0, 16)
  if (!blocks.some((block) => block.type === "logo")) {
    const logo = blockFromRow({ type: "logo" })
    if (logo) blocks.unshift(logo)
  }
  if (!blocks.some((block) => block.type === "footer")) {
    const footer = blockFromRow({ type: "footer", text: "Reswell — the marketplace for used surf gear.", showUnsubscribe: true })
    if (footer) blocks.push(footer)
  }
  return blocks
}

export function coerceAssistantEmail(raw: unknown): { reply: string; draft: AssistantEmailDraft } | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const blocks = coerceAssistantBlocks(row.blocks)
  const document = { blocks, htmlOverride: null }
  const parsed = emailStudioDocumentSchema.safeParse(document)
  if (!parsed.success || blocks.length === 0) return null
  return {
    reply: textOf(row.reply, 2000) || "Updated the draft.",
    draft: {
      name: textOf(row.name, 120),
      subject: textOf(row.subject, 200),
      previewText: textOf(row.previewText, 300),
      notes: textOf(row.notes, 2000),
      document: parsed.data,
    },
  }
}

function enumOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = textOf(value, 40).toLowerCase()
  return (allowed as readonly string[]).includes(text) ? text as T : fallback
}

export type AssistantFlowStep =
  | { type: "delay"; unit: "minutes" | "hours" | "days"; value: number }
  | { type: "email"; name: string; subject: string; previewText: string; heading: string; body: string; buttonLabel: string; buttonHref: string }
  | { type: "sms"; body: string }
  | { type: "webhook"; url: string; body: string }
  | { type: "update-profile"; property: string; value: string }
  | { type: "list-update"; listId: string; add: boolean }
  | {
      type: "split"
      mode: "profile-property" | "email-subscribed" | "event-property"
      property: string
      operator: "equals" | "contains" | "not-equals"
      value: string
      yes: AssistantFlowStep[]
      no: AssistantFlowStep[]
    }

export type AssistantFlowDraft = {
  reply: string
  name: string
  notes: string
  triggerType: "metric" | "list" | "segment" | "profile-date"
  triggerId: string
  triggerName: string
  dateProperty: string
  dateBeforeUnit: "days" | "weeks" | "months"
  dateBeforeValue: number
  recurrence: "never" | "annually" | "monthly" | "weekly"
  filterType: "none" | "email-subscribed" | "property-equals"
  filterProperty: string
  filterValue: string
  steps: AssistantFlowStep[]
}

function nestFlowBranches(
  tagged: { branch: "main" | "yes" | "no"; step: AssistantFlowStep }[],
): AssistantFlowStep[] {
  const steps: AssistantFlowStep[] = []
  for (let index = 0; index < tagged.length; index += 1) {
    const current = tagged[index]
    if (!current || current.branch !== "main") continue
    if (current.step.type !== "split") {
      steps.push(current.step)
      continue
    }
    const yes: AssistantFlowStep[] = []
    const no: AssistantFlowStep[] = []
    let next = index + 1
    while (next < tagged.length && tagged[next]?.branch !== "main") {
      const branched = tagged[next]
      if (branched?.branch === "no") no.push(branched.step)
      else if (branched) yes.push(branched.step)
      next += 1
    }
    index = next - 1
    steps.push({ ...current.step, yes, no })
  }
  return steps
}

export function coerceAssistantFlow(raw: unknown): AssistantFlowDraft | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (!Array.isArray(row.steps)) return null
  const tagged: { branch: "main" | "yes" | "no"; step: AssistantFlowStep }[] = []
  for (const item of row.steps.slice(0, 12)) {
    if (!item || typeof item !== "object") continue
    const step = item as Record<string, unknown>
    const typeName = textOf(step.type, 40).toLowerCase()
    const type = typeName === "wait" || typeName === "time-delay"
      ? "delay"
      : typeName === "branch" || typeName === "conditional"
        ? "split"
        : enumOf(step.type, stepTypes, "email")
    const branch = enumOf(step.branch, ["main", "yes", "no"] as const, "main")
    let built: AssistantFlowStep
    if (type === "delay") {
      const value = Math.round(Number(step.value))
      built = {
        type: "delay",
        unit: enumOf(step.unit, ["minutes", "hours", "days"] as const, "hours"),
        value: Number.isFinite(value) ? Math.min(365, Math.max(1, value)) : 1,
      }
    } else if (type === "sms") {
      built = { type: "sms", body: textOf(step.smsBody, 1600) || textOf(step.body, 1600) }
    } else if (type === "webhook") {
      built = { type: "webhook", url: textOf(step.url, 2000), body: textOf(step.body, 8000) }
    } else if (type === "update-profile") {
      built = { type: "update-profile", property: textOf(step.property, 120), value: textOf(step.propertyValue, 500) }
    } else if (type === "list-update") {
      built = { type: "list-update", listId: textOf(step.listId, 80), add: step.add !== false }
    } else if (type === "split") {
      built = {
        type: "split",
        mode: enumOf(step.splitMode ?? step.mode, ["profile-property", "email-subscribed", "event-property"] as const, "email-subscribed"),
        property: textOf(step.property, 120),
        operator: enumOf(step.operator, ["equals", "contains", "not-equals"] as const, "equals"),
        value: textOf(step.splitValue, 500) || textOf(step.propertyValue, 500),
        yes: [],
        no: [],
      }
    } else {
      built = {
        type: "email",
        name: textOf(step.name, 120) || "Flow email",
        subject: textOf(step.subject, 200),
        previewText: textOf(step.previewText, 300),
        heading: textOf(step.heading, 500) || "Hello",
        body: textOf(step.body, 8000),
        buttonLabel: textOf(step.buttonLabel, 500) || "Open Reswell",
        buttonHref: textOf(step.buttonHref, 2000) || RESWELL_EMAIL_HOME,
      }
    }
    tagged.push({ branch, step: built })
  }
  const steps = nestFlowBranches(tagged)
  if (steps.length === 0) return null
  const before = Math.round(Number(row.dateBeforeValue))
  return {
    reply: textOf(row.reply, 2000) || "Drafted the flow.",
    name: textOf(row.name, 120) || "Untitled flow",
    notes: textOf(row.notes, 2000),
    triggerType: enumOf(row.triggerType, ["metric", "list", "segment", "profile-date"] as const, "metric"),
    triggerId: textOf(row.triggerId, 80),
    triggerName: textOf(row.triggerName, 200),
    dateProperty: textOf(row.dateProperty, 120),
    dateBeforeUnit: enumOf(row.dateBeforeUnit, ["days", "weeks", "months"] as const, "days"),
    dateBeforeValue: Number.isFinite(before) ? Math.min(365, Math.max(0, before)) : 0,
    recurrence: enumOf(row.recurrence, ["never", "annually", "monthly", "weekly"] as const, "never"),
    filterType: enumOf(row.filterType, ["none", "email-subscribed", "property-equals"] as const, "email-subscribed"),
    filterProperty: textOf(row.filterProperty, 120),
    filterValue: textOf(row.filterValue, 500),
    steps,
  }
}

export function coerceAssistantStudio(raw: unknown): {
  reply: string
  email: AssistantEmailDraft | null
  flow: AssistantFlowDraft | null
} | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const emailFlag = textOf(row.applyEmail, 3).toLowerCase()
  const flowFlag = textOf(row.applyFlow, 3).toLowerCase()
  const hasBlocks = Array.isArray(row.blocks) && row.blocks.length > 0
  const hasSteps = Array.isArray(row.steps) && row.steps.length > 0
  const email = hasBlocks && emailFlag !== "no"
    ? coerceAssistantEmail({
        reply: row.reply,
        name: row.name,
        subject: row.subject,
        previewText: row.previewText,
        notes: row.notes,
        blocks: row.blocks,
      })
    : null
  const flow = hasSteps && flowFlag !== "no"
    ? coerceAssistantFlow({
        reply: row.reply,
        name: textOf(row.flowName, 120) || textOf(row.name, 120),
        notes: textOf(row.flowNotes, 2000) || textOf(row.notes, 2000),
        triggerType: row.triggerType,
        triggerId: row.triggerId,
        triggerName: row.triggerName,
        dateProperty: row.dateProperty,
        dateBeforeUnit: row.dateBeforeUnit,
        dateBeforeValue: row.dateBeforeValue,
        recurrence: row.recurrence,
        filterType: row.filterType,
        filterProperty: row.filterProperty,
        filterValue: row.filterValue,
        steps: row.steps,
      })
    : null
  if (!email && !flow) return null
  return {
    reply: textOf(row.reply, 2000) || email?.reply || flow?.reply || "Updated the draft.",
    email: email?.draft ?? null,
    flow,
  }
}

export function documentForFlowEmail(step: {
  heading: string
  body: string
  buttonLabel: string
  buttonHref: string
}): EmailStudioDocument {
  const coerced = coerceAssistantEmail({
    blocks: [
      { type: "logo" },
      { type: "heading", text: step.heading, align: "left" },
      { type: "text", text: step.body, align: "left" },
      { type: "button", label: step.buttonLabel, href: step.buttonHref, align: "center" },
      { type: "footer", text: "Reswell — the marketplace for used surf gear.", showUnsubscribe: true },
    ],
  })
  if (!coerced) throw new Error("The draft email did not fit the studio.")
  return coerced.draft.document
}
