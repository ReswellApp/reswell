import "server-only"

import { generateText, Output } from "ai"
import { z } from "zod"
import { klaviyoFromEmail, klaviyoFromLabel } from "@/lib/email-studio/flow-definition"
import { insertEmailStudioDocument } from "@/lib/db/emailStudio"
import {
  getEmailStudioFlow,
  insertEmailStudioFlow,
  insertEmailStudioMessage,
  listEmailStudioMessages,
  updateEmailStudioFlow,
} from "@/lib/db/emailStudioFlows"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { EmailBlock, EmailStudioDocument } from "@/lib/types/emailStudio"
import type { EmailStudioFlowDefinition, EmailStudioFlowStep, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
import { listKlaviyoFlowCatalogService } from "@/lib/services/emailStudioFlows"
import { emailStudioDocumentSchema } from "@/lib/validations/emailStudio"
import { emailStudioFlowDefinitionSchema } from "@/lib/validations/emailStudioFlow"

const align = z.enum(["left", "center"])
const looseBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("logo") }),
  z.object({ type: z.literal("eyebrow"), text: z.string().max(500), align }),
  z.object({ type: z.literal("heading"), text: z.string().max(500), align }),
  z.object({ type: z.literal("text"), text: z.string().max(8000), align }),
  z.object({
    type: z.literal("image"),
    src: z.string().max(2000),
    alt: z.string().max(500),
    href: z.string().max(2000),
  }),
  z.object({ type: z.literal("button"), label: z.string().max(500), href: z.string().max(2000), align }),
  z.object({
    type: z.literal("split"),
    imageSrc: z.string().max(2000),
    imageAlt: z.string().max(500),
    title: z.string().max(500),
    text: z.string().max(8000),
    buttonLabel: z.string().max(500),
    buttonHref: z.string().max(2000),
  }),
  z.object({
    type: z.literal("details"),
    title: z.string().max(500),
    rows: z.array(z.object({ label: z.string().max(500), value: z.string().max(2000) })).max(12),
  }),
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("spacer"), height: z.number().int().min(8).max(80) }),
  z.object({ type: z.literal("footer"), text: z.string().max(8000), showUnsubscribe: z.boolean() }),
])

const emailDraftSchema = z.object({
  name: z.string().max(120),
  subject: z.string().max(200),
  previewText: z.string().max(300),
  notes: z.string().max(2000),
  blocks: z.array(looseBlockSchema).min(1).max(20),
})

const flowStepSchema: z.ZodType<FlowProposalStep> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("delay"), unit: z.enum(["minutes", "hours", "days"]), value: z.number().int().min(1).max(365) }),
    z.object({ type: z.literal("email"), email: emailDraftSchema }),
    z.object({ type: z.literal("sms"), body: z.string().max(1600) }),
    z.object({ type: z.literal("webhook"), url: z.string().max(2000), body: z.string().max(8000) }),
    z.object({ type: z.literal("update-profile"), property: z.string().max(120), value: z.string().max(500) }),
    z.object({ type: z.literal("list-update"), listId: z.string().max(80), add: z.boolean() }),
    z.object({
      type: z.literal("split"),
      mode: z.enum(["profile-property", "email-subscribed", "event-property"]),
      property: z.string().max(120),
      operator: z.enum(["equals", "contains", "not-equals"]),
      value: z.string().max(500),
      yes: z.array(flowStepSchema).max(6),
      no: z.array(flowStepSchema).max(6),
    }),
  ]),
)

type FlowProposalStep = {
  type: "delay"
  unit: "minutes" | "hours" | "days"
  value: number
} | {
  type: "email"
  email: z.infer<typeof emailDraftSchema>
} | {
  type: "sms"
  body: string
} | {
  type: "webhook"
  url: string
  body: string
} | {
  type: "update-profile"
  property: string
  value: string
} | {
  type: "list-update"
  listId: string
  add: boolean
} | {
  type: "split"
  mode: "profile-property" | "email-subscribed" | "event-property"
  property: string
  operator: "equals" | "contains" | "not-equals"
  value: string
  yes: FlowProposalStep[]
  no: FlowProposalStep[]
}

const assistantSchema = z.object({
  reply: z.string().max(4000),
  email: emailDraftSchema.nullable(),
  flow: z.object({
    name: z.string().max(120),
    notes: z.string().max(2000),
    triggerType: z.enum(["metric", "list", "segment", "profile-date"]),
    triggerId: z.string().max(80),
    triggerName: z.string().max(200),
    dateProperty: z.string().max(120),
    dateBeforeUnit: z.enum(["days", "weeks", "months"]),
    dateBeforeValue: z.number().int().min(0).max(365),
    recurrence: z.enum(["never", "annually", "monthly", "weekly"]),
    filterType: z.enum(["none", "email-subscribed", "property-equals"]),
    filterProperty: z.string().max(120),
    filterValue: z.string().max(500),
    steps: z.array(flowStepSchema).min(1).max(12),
  }).nullable(),
})

const SYSTEM = `You write Reswell Klaviyo emails and flows for staff in the admin email studio.

Voice: short, plain, first person from Reswell. No hype. Merge tags stay as Klaviyo Django, for example {{ first_name|default:'there' }} and {{ event|lookup:'order_num' }}.

Email blocks, in order: logo, eyebrow, heading, text, image, button, split, details, divider, spacer, footer. Always include a footer with showUnsubscribe true on marketing mail. Use logo once at the top. Keep images as empty src unless the user gave a URL.

When the user is editing one email, fill email and leave flow null unless they asked for a flow.
When they ask for a flow, fill flow. Put each email's copy inside that step. Leave email null unless they also asked to change the open email.
Use trigger ids from the catalog when you know them. If you only know a metric name, put it in triggerName and leave triggerId empty.
Flows are saved as drafts. Never tell the user the flow is live.
reply is two or three sentences saying what you changed.`

function feature() {
  const found = APP_LLM_FEATURES.find((item) => item.id === "email_studio")
  if (!found) throw new Error("email_studio is missing from APP_LLM_FEATURES")
  return found
}

export function isEmailStudioAssistantEnabled(): boolean {
  return isAppLlmFeatureEnabled(feature())
}

function materializeBlocks(blocks: z.infer<typeof looseBlockSchema>[]): EmailBlock[] {
  return blocks.map((block) => {
    const id = crypto.randomUUID()
    if (block.type === "logo") {
      return {
        id,
        type: "logo",
        src: "https://www.reswell.app/images/reswell-logo.png",
        alt: "Reswell",
        href: "https://www.reswell.app",
        width: 140,
      }
    }
    if (block.type === "image") return { id, ...block, width: 560, height: null }
    if (block.type === "split") {
      return { id, ...block, imageHref: "", imageWidth: 240, imageHeight: null }
    }
    if (block.type === "details") {
      return {
        id,
        type: "details",
        title: block.title,
        rows: block.rows.map((row) => ({ id: crypto.randomUUID(), ...row })),
      }
    }
    return { id, ...block }
  })
}

function documentFromDraft(draft: z.infer<typeof emailDraftSchema>): EmailStudioDocument {
  const document = { blocks: materializeBlocks(draft.blocks), htmlOverride: null }
  const parsed = emailStudioDocumentSchema.safeParse(document)
  if (!parsed.success) throw new Error("The draft email did not fit the studio.")
  return parsed.data
}

type Proposal = z.infer<typeof assistantSchema>

function chainSteps(
  proposalSteps: FlowProposalStep[],
  userId: string,
  client: Awaited<ReturnType<typeof createClient>>,
  flowName: string,
  triggerMetric: string,
): Promise<{ entry: string | null; steps: EmailStudioFlowStep[] }> {
  return (async () => {
    const steps: EmailStudioFlowStep[] = []
    let entry: string | null = null
    let previousNext: { step: EmailStudioFlowStep } | null = null
    for (const proposal of proposalSteps) {
      const id = crypto.randomUUID()
      let step: EmailStudioFlowStep
      if (proposal.type === "email") {
        const created = await insertEmailStudioDocument(client, {
          kind: "project",
          name: proposal.email.name || "Flow email",
          subject: proposal.email.subject,
          previewText: proposal.email.previewText,
          flowName,
          flowId: "",
          triggerMetric,
          notes: proposal.email.notes,
          document: documentFromDraft(proposal.email),
          userId,
        })
        step = {
          id,
          type: "email",
          projectId: created.id,
          fromEmail: klaviyoFromEmail(),
          fromLabel: klaviyoFromLabel(),
          smartSending: true,
          transactional: false,
          next: null,
        }
      } else if (proposal.type === "split") {
        const yes = await chainSteps(proposal.yes, userId, client, flowName, triggerMetric)
        const no = await chainSteps(proposal.no, userId, client, flowName, triggerMetric)
        steps.push(...yes.steps, ...no.steps)
        step = {
          id,
          type: "split",
          mode: proposal.mode,
          property: proposal.property,
          operator: proposal.operator,
          value: proposal.value,
          yes: yes.entry,
          no: no.entry,
        }
      } else if (proposal.type === "delay") {
        step = { id, type: "delay", unit: proposal.unit, value: proposal.value, next: null }
      } else if (proposal.type === "sms") {
        step = { id, type: "sms", body: proposal.body, smartSending: true, next: null }
      } else if (proposal.type === "webhook") {
        step = { id, type: "webhook", url: proposal.url, body: proposal.body, next: null }
      } else if (proposal.type === "update-profile") {
        step = { id, type: "update-profile", property: proposal.property, value: proposal.value, next: null }
      } else {
        step = { id, type: "list-update", listId: proposal.listId, add: proposal.add, next: null }
      }
      if (!entry) entry = id
      if (previousNext && previousNext.step.type !== "split") previousNext.step.next = id
      steps.push(step)
      previousNext = { step }
    }
    return { entry, steps }
  })()
}

function definitionFromProposal(proposal: NonNullable<Proposal["flow"]>, built: {
  entry: string | null
  steps: EmailStudioFlowStep[]
}): EmailStudioFlowDefinition {
  const trigger = (() => {
    if (proposal.triggerType === "list") {
      return { type: "list" as const, listId: proposal.triggerId, listName: proposal.triggerName }
    }
    if (proposal.triggerType === "segment") {
      return { type: "segment" as const, segmentId: proposal.triggerId, segmentName: proposal.triggerName }
    }
    if (proposal.triggerType === "profile-date") {
      return {
        type: "profile-date" as const,
        property: proposal.dateProperty || proposal.triggerName,
        beforeUnit: proposal.dateBeforeUnit,
        beforeValue: proposal.dateBeforeValue,
        recurrence: proposal.recurrence,
      }
    }
    return { type: "metric" as const, metricId: proposal.triggerId, metricName: proposal.triggerName }
  })()
  const profileFilter = proposal.filterType === "property-equals"
    ? { type: "property-equals" as const, property: proposal.filterProperty, value: proposal.filterValue }
    : proposal.filterType === "none"
      ? { type: "none" as const }
      : { type: "email-subscribed" as const }
  const definition = { trigger, profileFilter, entryStepId: built.entry, steps: built.steps }
  const parsed = emailStudioFlowDefinitionSchema.safeParse(definition)
  if (!parsed.success) throw new Error("The draft flow did not fit the studio.")
  return parsed.data
}

function catalogLines(label: string, options: KlaviyoCatalogOption[]): string {
  const lines = options.slice(0, 60).map((option) => `${option.id} | ${option.name}`)
  return lines.length ? `${label}:\n${lines.join("\n")}` : `${label}: none loaded`
}

export async function listEmailStudioAssistantMessagesService(
  scope: "email" | "flow",
  scopeId: string,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" as const }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" as const }
  }
  try {
    const client = (() => {
      try {
        return createServiceRoleClient()
      } catch {
        return supabase
      }
    })()
    return { success: true as const, data: await listEmailStudioMessages(client, scope, scopeId) }
  } catch (error) {
    console.error("[email_studio] list assistant messages failed", error)
    return { error: "Could not load the conversation" as const }
  }
}

export async function askEmailStudioAssistantService(input: {
  scope: "email" | "flow"
  scopeId: string
  message: string
  snapshot: string
}): Promise<
  | {
      success: true
      reply: string
      email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument } | null
      flowId: string | null
    }
  | { error: string }
> {
  if (!isEmailStudioAssistantEnabled()) return { error: "The email assistant is not configured." }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { error: "Forbidden" }
  }
  const client = (() => {
    try {
      return createServiceRoleClient()
    } catch {
      return supabase
    }
  })()

  const history = await listEmailStudioMessages(client, input.scope, input.scopeId)
  const catalog = await listKlaviyoFlowCatalogService()
  await insertEmailStudioMessage(client, {
    scope: input.scope,
    scopeId: input.scopeId,
    role: "user",
    content: input.message,
    userId: user.id,
  })

  let output: Proposal
  try {
    const result = await generateText({
      model: resolveConfiguredModel(feature()),
      output: Output.object({ schema: assistantSchema }),
      system: SYSTEM,
      messages: [
        ...history.slice(-8).map((item) => ({ role: item.role, content: item.content })),
        {
          role: "user" as const,
          content: [
            `Scope: ${input.scope}`,
            `Known metrics: ${KNOWN_KLAVIYO_METRIC_NAMES.join(", ")}`,
            catalogLines("Klaviyo metrics", catalog.metrics),
            catalogLines("Klaviyo lists", catalog.lists),
            catalogLines("Klaviyo segments", catalog.segments),
            "Current draft:",
            input.snapshot.slice(0, 12000),
            `Request: ${input.message}`,
          ].join("\n\n"),
        },
      ],
      temperature: 0.4,
      maxOutputTokens: 4000,
      maxRetries: 1,
      timeout: 50_000,
      providerOptions: { gateway: { tags: gatewayTagsForFeature("email_studio") } },
    })
    if (!result.output) return { error: "The assistant did not return a draft." }
    output = result.output
  } catch (error) {
    console.error("[email_studio] assistant failed", error)
    return { error: "The assistant could not draft that." }
  }

  let email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument } | null = null
  let flowId: string | null = null
  try {
    if (output.email && input.scope === "email") {
      email = {
        subject: output.email.subject,
        previewText: output.email.previewText,
        notes: output.email.notes,
        document: documentFromDraft(output.email),
      }
    }
    if (output.flow) {
      const triggerMetric = output.flow.triggerType === "metric" ? output.flow.triggerName : ""
      const built = await chainSteps(output.flow.steps, user.id, client, output.flow.name, triggerMetric)
      const definition = definitionFromProposal(output.flow, built)
      if (input.scope === "flow") {
        const existing = await getEmailStudioFlow(client, input.scopeId)
        if (!existing) return { error: "Flow not found" }
        await updateEmailStudioFlow(client, {
          id: existing.id,
          name: output.flow.name || existing.name,
          notes: output.flow.notes,
          definition,
          userId: user.id,
        })
        flowId = existing.id
      } else {
        const created = await insertEmailStudioFlow(client, {
          name: output.flow.name || "Untitled flow",
          definition,
          userId: user.id,
        })
        if (output.flow.notes) {
          await updateEmailStudioFlow(client, {
            id: created.id,
            name: created.name,
            notes: output.flow.notes,
            definition,
            userId: user.id,
          })
        }
        flowId = created.id
      }
    }
  } catch (error) {
    console.error("[email_studio] apply assistant draft failed", error)
    const message = error instanceof Error ? error.message : ""
    if (message.startsWith("The draft")) return { error: message }
    return { error: "Could not apply that draft." }
  }

  await insertEmailStudioMessage(client, {
    scope: input.scope,
    scopeId: input.scopeId,
    role: "assistant",
    content: output.reply,
    userId: null,
  })
  return { success: true, reply: output.reply, email, flowId }
}
