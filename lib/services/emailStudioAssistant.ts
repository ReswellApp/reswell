import "server-only"

import { generateText, Output } from "ai"
import {
  assistantEmailModelSchema,
  assistantFlowModelSchema,
  assistantWantsFlow,
  coerceAssistantEmail,
  coerceAssistantFlow,
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

const SYSTEM = `You are the Reswell email studio assistant. Staff are editing an unsent draft. Complete the request.

Write short, plain Reswell copy. Keep Klaviyo tags as typed, for example {{ first_name|default:'there' }} and {{ event|lookup:'order_num' }}.

For an email, return the full block list, not only the block that changed. Block type is one of logo, eyebrow, heading, text, image, button, split, details, divider, spacer, footer. Put a logo first and a footer last with showUnsubscribe true. Fill every string; use an empty string when a field does not apply. align is left or center.

For a flow, return a linear list of delay, email, sms, webhook, update-profile, or list-update steps. Each email step includes subject, heading, and body. Use a trigger id from the catalog when you have one.

reply is two sentences about what you drafted. Do not refuse, apologize, or discuss policy.`

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

function chainSteps(
  proposalSteps: AssistantFlowStep[],
  userId: string,
  client: Awaited<ReturnType<typeof createClient>>,
  flowName: string,
  triggerMetric: string,
): Promise<{ entry: string | null; steps: EmailStudioFlowStep[] }> {
  return (async () => {
    const steps: EmailStudioFlowStep[] = []
    let entry: string | null = null
    let previous: EmailStudioFlowStep | null = null
    for (const proposal of proposalSteps) {
      const id = crypto.randomUUID()
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
  })()
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
  flow: boolean
  prompt: string
  history: { role: "user" | "assistant"; content: string }[]
}): Promise<{ reply: string; email: AssistantEmailDraft | null; flow: AssistantFlowDraft | null }> {
  const model = resolveConfiguredModel(feature())
  const messages = [
    ...input.history.slice(-6),
    { role: "user" as const, content: input.prompt },
  ]
  try {
    if (input.flow) {
      const result = await generateText({
        model,
        output: Output.object({ schema: assistantFlowModelSchema }),
        system: SYSTEM,
        messages,
        temperature: 0.2,
        maxOutputTokens: 6000,
        maxRetries: 0,
        timeout: 45_000,
        providerOptions: providerOptions(),
      })
      const flow = coerceAssistantFlow(result.output)
      if (!flow) throw new Error("empty flow")
      return { reply: flow.reply, email: null, flow }
    }
    const result = await generateText({
      model,
      output: Output.object({ schema: assistantEmailModelSchema }),
      system: SYSTEM,
      messages,
      temperature: 0.2,
      maxOutputTokens: 6000,
      maxRetries: 0,
      timeout: 45_000,
      providerOptions: providerOptions(),
    })
    const email = coerceAssistantEmail(result.output)
    if (!email) throw new Error("empty email")
    return { reply: email.reply, email: email.draft, flow: null }
  } catch (error) {
    console.error("[email_studio] structured draft failed", error)
  }

  const fallback = await generateText({
    model,
    system: `${SYSTEM}\n\nReturn one JSON object and no other text.`,
    messages,
    temperature: 0.2,
    maxOutputTokens: 6000,
    maxRetries: 0,
    timeout: 45_000,
    providerOptions: providerOptions(),
  })
  const json = extractJsonObject(fallback.text)
  if (input.flow) {
    const flow = coerceAssistantFlow(json)
    if (flow) return { reply: flow.reply, email: null, flow }
  }
  const email = coerceAssistantEmail(json)
  if (email) return { reply: email.reply, email: email.draft, flow: null }
  const flow = coerceAssistantFlow(json)
  if (flow) return { reply: flow.reply, email: null, flow }
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

  const wantsFlow = assistantWantsFlow(input.scope, input.message)
  let output: { reply: string; email: AssistantEmailDraft | null; flow: AssistantFlowDraft | null }
  try {
    output = await draftFromModel({
      flow: wantsFlow,
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
    return { error: "The assistant could not draft that. Try again with the change you want, such as a new subject or a two-email flow." }
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
