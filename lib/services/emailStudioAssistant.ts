import "server-only"

import { generateText, Output } from "ai"
import {
  assistantStudioModelSchema,
  coerceAssistantEmail,
  coerceAssistantFlow,
  coerceAssistantStudio,
  documentForFlowEmail,
  extractJsonObject,
  type AssistantEmailDraft,
  type AssistantFlowDraft,
  type AssistantFlowStep,
} from "@/lib/email-studio/assistant-draft"
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
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { EmailStudioDocument } from "@/lib/types/emailStudio"
import type { EmailStudioFlowDefinition, EmailStudioFlowStep, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
import { listKlaviyoFlowCatalogService } from "@/lib/services/emailStudioFlows"
import { emailStudioFlowDefinitionSchema } from "@/lib/validations/emailStudioFlow"

const SYSTEM = `You are the Reswell email studio assistant. Staff describe an unsent email or Klaviyo flow in ordinary language. Build exactly what they asked for: one email, a flow, or both in the same reply.

Write short, plain Reswell copy. Keep Klaviyo tags as typed, for example {{ first_name|default:'there' }} and {{ event|lookup:'order_num' }}. Do not set colors, hex values, or font names. The studio applies the Reswell palette and Stack Sans.

applyEmail is yes when the request creates or changes the open email. applyFlow is yes when the request creates or changes a flow. Set the other to no and leave its list empty.

For an email, return the full block list, not only the block that changed. Block type is one of logo, eyebrow, heading, text, image, button, split, details, divider, spacer, footer. Put a logo first and a footer last with showUnsubscribe true. align is left or center.

For a flow, return steps in order. type is delay, email, sms, webhook, update-profile, list-update, or split. branch is main, yes, or no. A split is a main step. The yes and no steps that follow it belong to that split until the next main step. splitMode is profile-property, email-subscribed, or event-property. Each email step includes subject, heading, and body. Use a trigger id from the catalog when you have one. A step after the split on the main branch runs after both branches.

Fill every string. Use an empty string when a field does not apply, and 0 for an unused number. reply is two sentences about what you drafted. Do not refuse, apologize, or discuss policy.`

const SAFETY = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
].map((category) => ({ category, threshold: "BLOCK_NONE" as const }))

function feature() {
  const found = APP_LLM_FEATURES.find((item) => item.id === "email_studio")
  if (!found) throw new Error("email_studio is missing from APP_LLM_FEATURES")
  return found
}

export function isEmailStudioAssistantEnabled(): boolean {
  return isAppLlmFeatureEnabled(feature())
}

function attachFlowContinuation(
  branch: { entry: string | null; steps: EmailStudioFlowStep[] },
  target: string | null,
): void {
  if (!target || !branch.entry) return
  const byId = new Map(branch.steps.map((step) => [step.id, step]))
  const seen = new Set<string>()
  function walk(id: string | null): void {
    if (!id || seen.has(id)) return
    seen.add(id)
    const step = byId.get(id)
    if (!step) return
    if (step.type === "split") {
      if (!step.yes) step.yes = target
      else walk(step.yes)
      if (!step.no) step.no = target
      else walk(step.no)
      return
    }
    if (step.next) walk(step.next)
    else step.next = target
  }
  walk(branch.entry)
}

async function linkProposalSteps(
  proposalSteps: AssistantFlowStep[],
  userId: string,
  client: Awaited<ReturnType<typeof createClient>>,
  flowName: string,
  triggerMetric: string,
): Promise<{ entry: string | null; steps: EmailStudioFlowStep[] }> {
  const steps: EmailStudioFlowStep[] = []
  let entry: string | null = null
  let previous: EmailStudioFlowStep | null = null
  for (let index = 0; index < proposalSteps.length; index += 1) {
    const proposal = proposalSteps[index]
    if (!proposal) continue
    const id = crypto.randomUUID()
    if (proposal.type === "split") {
      const rest = await linkProposalSteps(proposalSteps.slice(index + 1), userId, client, flowName, triggerMetric)
      const yes = await linkProposalSteps(proposal.yes, userId, client, flowName, triggerMetric)
      const no = await linkProposalSteps(proposal.no, userId, client, flowName, triggerMetric)
      attachFlowContinuation(yes, rest.entry)
      attachFlowContinuation(no, rest.entry)
      const step: EmailStudioFlowStep = {
        id,
        type: "split",
        mode: proposal.mode,
        property: proposal.property,
        operator: proposal.operator,
        value: proposal.value,
        yes: yes.entry ?? rest.entry,
        no: no.entry ?? rest.entry,
      }
      if (!entry) entry = id
      if (previous && "next" in previous) previous.next = id
      steps.push(step, ...yes.steps, ...no.steps, ...rest.steps)
      return { entry, steps }
    }
    let step: EmailStudioFlowStep
    if (proposal.type === "email") {
      const created = await insertEmailStudioDocument(client, {
        kind: "project",
        name: proposal.name || "Flow email",
        subject: proposal.subject,
        previewText: proposal.previewText,
        flowName,
        flowId: "",
        triggerMetric,
        notes: "",
        document: documentForFlowEmail(proposal),
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
    } else if (proposal.type === "delay") {
      step = { id, type: "delay", unit: proposal.unit, value: proposal.value, next: null }
    } else if (proposal.type === "sms") {
      step = { id, type: "sms", body: proposal.body || "Reswell", smartSending: true, next: null }
    } else if (proposal.type === "webhook") {
      step = { id, type: "webhook", url: proposal.url || "https://www.reswell.app", body: proposal.body, next: null }
    } else if (proposal.type === "update-profile") {
      step = { id, type: "update-profile", property: proposal.property || "source", value: proposal.value, next: null }
    } else {
      step = { id, type: "list-update", listId: proposal.listId || "list", add: proposal.add, next: null }
    }
    if (!entry) entry = id
    if (previous && "next" in previous) previous.next = id
    steps.push(step)
    previous = step
  }
  return { entry, steps }
}

function chainSteps(
  proposalSteps: AssistantFlowStep[],
  userId: string,
  client: Awaited<ReturnType<typeof createClient>>,
  flowName: string,
  triggerMetric: string,
): Promise<{ entry: string | null; steps: EmailStudioFlowStep[] }> {
  return linkProposalSteps(proposalSteps, userId, client, flowName, triggerMetric)
}

function definitionFromProposal(proposal: AssistantFlowDraft, built: {
  entry: string | null
  steps: EmailStudioFlowStep[]
}): EmailStudioFlowDefinition {
  const trigger = proposal.triggerType === "list"
    ? { type: "list" as const, listId: proposal.triggerId, listName: proposal.triggerName }
    : proposal.triggerType === "segment"
      ? { type: "segment" as const, segmentId: proposal.triggerId, segmentName: proposal.triggerName }
      : proposal.triggerType === "profile-date"
        ? {
            type: "profile-date" as const,
            property: proposal.dateProperty || proposal.triggerName || "Birthday",
            beforeUnit: proposal.dateBeforeUnit,
            beforeValue: proposal.dateBeforeValue,
            recurrence: proposal.recurrence,
          }
        : { type: "metric" as const, metricId: proposal.triggerId, metricName: proposal.triggerName }
  const profileFilter = proposal.filterType === "property-equals"
    ? { type: "property-equals" as const, property: proposal.filterProperty || "source", value: proposal.filterValue }
    : proposal.filterType === "none"
      ? { type: "none" as const }
      : { type: "email-subscribed" as const }
  const parsed = emailStudioFlowDefinitionSchema.safeParse({
    trigger,
    profileFilter,
    entryStepId: built.entry,
    steps: built.steps,
  })
  if (!parsed.success) throw new Error("The draft flow did not fit the studio.")
  return parsed.data
}

function catalogLines(label: string, options: KlaviyoCatalogOption[]): string {
  const lines = options.slice(0, 25).map((option) => `${option.id} | ${option.name}`)
  return lines.length ? `${label}:\n${lines.join("\n")}` : ""
}

function providerOptions() {
  return {
    gateway: { tags: gatewayTagsForFeature("email_studio") },
    google: { safetySettings: SAFETY },
  }
}

async function draftFromModel(input: {
  prompt: string
  history: { role: "user" | "assistant"; content: string }[]
}): Promise<{ reply: string; email: AssistantEmailDraft | null; flow: AssistantFlowDraft | null }> {
  const model = resolveConfiguredModel(feature())
  const messages = [
    ...input.history.slice(-6),
    { role: "user" as const, content: input.prompt },
  ]
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: assistantStudioModelSchema }),
      system: SYSTEM,
      messages,
      temperature: 0.2,
      maxOutputTokens: 8000,
      maxRetries: 0,
      timeout: 45_000,
      providerOptions: providerOptions(),
    })
    const draft = coerceAssistantStudio(result.output)
    if (!draft) throw new Error("empty draft")
    return draft
  } catch (error) {
    console.error("[email_studio] structured draft failed", error)
  }

  const fallback = await generateText({
    model,
    system: `${SYSTEM}\n\nReturn one JSON object and no other text.`,
    messages,
    temperature: 0.2,
    maxOutputTokens: 8000,
    maxRetries: 0,
    timeout: 45_000,
    providerOptions: providerOptions(),
  })
  const json = extractJsonObject(fallback.text)
  const draft = coerceAssistantStudio(json)
  if (draft) return draft
  const email = coerceAssistantEmail(json)
  const flow = coerceAssistantFlow(json)
  if (email || flow) {
    return {
      reply: email?.reply || flow?.reply || "Updated the draft.",
      email: email?.draft ?? null,
      flow,
    }
  }
  throw new Error("The assistant could not draft that.")
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

  let output: { reply: string; email: AssistantEmailDraft | null; flow: AssistantFlowDraft | null }
  try {
    output = await draftFromModel({
      history: history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
      prompt: [
        `Scope: ${input.scope}`,
        catalogLines("Metrics", catalog.metrics),
        catalogLines("Lists", catalog.lists),
        catalogLines("Segments", catalog.segments),
        "Current draft:",
        input.snapshot.slice(0, 8000),
        `Request: ${input.message}`,
      ].filter(Boolean).join("\n\n"),
    })
  } catch (error) {
    console.error("[email_studio] assistant failed", error)
    return { error: "The assistant could not draft that. Say what the email or flow should do and try again." }
  }

  let email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument } | null = null
  let flowId: string | null = null
  try {
    if (output.email && input.scope === "email") {
      email = {
        subject: output.email.subject,
        previewText: output.email.previewText,
        notes: output.email.notes,
        document: output.email.document,
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
