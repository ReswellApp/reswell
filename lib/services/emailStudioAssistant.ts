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
import { designFlatEmailDocument } from "@/lib/email-studio/frames"
import {
  applyEmailStudioEmailCommands,
  applyEmailStudioFlowCommands,
  emailStudioEmailSnapshot,
  emailStudioFlowSnapshot,
} from "@/lib/email-studio/commands"
import { findEmailBlock } from "@/lib/email-studio/document-tree"
import { klaviyoFromEmail, klaviyoFromLabel } from "@/lib/email-studio/flow-definition"
import { getEmailStudioDocument, insertEmailStudioDocument } from "@/lib/db/emailStudio"
import {
  getEmailStudioFlow,
  insertEmailStudioFlow,
  insertEmailStudioMessage,
  listEmailStudioMessages,
  updateEmailStudioFlow,
} from "@/lib/db/emailStudioFlows"
import { insertEmailStudioProposal } from "@/lib/db/emailStudioRevisions"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "@/lib/llm/app-models"
import { KNOWN_KLAVIYO_METRIC_NAMES } from "@/lib/klaviyo/event-log-shared"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type {
  EmailBlock,
  EmailStudioDocument,
  EmailStudioRecord,
} from "@/lib/types/emailStudio"
import type {
  EmailStudioEmailCommand,
  EmailStudioFlowCommand,
  EmailStudioFlowSnapshot,
} from "@/lib/types/emailStudioCommands"
import type { EmailStudioFlowDefinition, EmailStudioFlowStep, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
import { listKlaviyoFlowCatalogService } from "@/lib/services/emailStudioFlows"
import { emailStudioFlowDefinitionSchema } from "@/lib/validations/emailStudioFlow"
import {
  assistantScreenshotInstruction,
  assistantTranscriptContent,
  type AssistantScreenshot,
} from "@/lib/email-studio/assistant-images"
import {
  buildStructuredEmailBrief,
  RESWELL_EMAIL_VOICE_PROMPT,
} from "@/lib/email-studio/reswell-email-voice"
import type { GenerateEmailStudioInput } from "@/lib/validations/emailStudio"

const SYSTEM = `You are the Reswell email studio assistant. Staff describe an unsent email or Klaviyo flow in ordinary language. Build exactly what they asked for: one email, a flow, or both in the same reply.

${RESWELL_EMAIL_VOICE_PROMPT}

Keep Klaviyo tags as typed, for example {{ first_name|default:'there' }} and {{ event|lookup:'order_num' }}. Do not set colors, hex values, or font names. The studio applies the Reswell palette and Stack Sans.

applyEmail is yes when the request creates or changes the open email. applyFlow is yes when the request creates or changes a flow. Set the other to no and leave its list empty.

For an email, choose operation deliberately. Use replace-selection when the request refers to the selected block and return that replacement block first. Use insert-after-selection when asked to add content near the selection. Use metadata-only for subject, preview, or notes changes, and list exactly those requested keys in metadataFields; this permits an intentional empty value such as removing preview text. Use an empty metadataFields list for other operations. Use replace-document only for a new email or a whole-email redesign. Block type is one of section, logo, eyebrow, heading, text, image, button, split, details, divider, spacer, footer. A section is an email-safe visual container with 1–3 columns; choose its surface, padding, gap, mobile stacking, and column content. A column may include eyebrow, imageSrc, heading, text, buttonLabel, and buttonHref. align is left or center.

Design a replace-document email the way a layout tool would. Return logo, then at least two section blocks that use different surfaces, then a footer with showUnsubscribe true. When no screenshot is attached, open with a dark or muted hero, follow with a content section (one column, an editorial two-column split, or a three-up), and end with a dark closer that holds the button. When screenshots are attached, they are the design to build: match their section order, column counts, alignment, and readable copy, and choose dark, muted, or white surfaces from what the image shows. Use replace-document when a screenshot shows a whole email. Do not embed the screenshot itself. A previous message may say a screenshot was attached. That image is not included. Only screenshots on the current message can be seen. Do not return a loose stack of heading, text, and button for a new email or a redesign. Put buttons on white, muted, or dark surfaces so they stay visible. Leave image src empty when you do not have a real https image.

For a flow, return steps in order. type is delay, email, sms, webhook, update-profile, list-update, or split. branch is main, yes, or no. A split is a main step. The yes and no steps that follow it belong to that split until the next main step. splitMode is profile-property, email-subscribed, or event-property. Each email step includes subject, previewText, layout, eyebrow, heading, body, buttonLabel, and buttonHref. layout is announcement, editorial, transactional, or product. The studio turns that step into a designed email with a hero, sections, and a closer. Use transactional for orders and shipping, product for a listing, editorial for a story, and announcement for a campaign. Use a trigger id from the catalog when you have one. If you only know a metric name, put it in triggerName and leave triggerId empty. A step after the split on the main branch runs after both branches. Flows are saved as drafts. Never tell the user the flow is live.

Fill every string. Use an empty string when a field does not apply, 0 for an unused number, and an empty columns list outside section blocks. reply is two sentences about what you drafted. Do not refuse, apologize, or discuss policy.`

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

interface ProposedFlowEmailProject {
  id: string
  name: string
  subject: string
  previewText: string
  triggerMetric: string
  notes: string
  document: EmailStudioDocument
}

function linkProposalSteps(
  proposalSteps: AssistantFlowStep[],
  flowName: string,
  triggerMetric: string,
  emailProjects: ProposedFlowEmailProject[],
): { entry: string | null; steps: EmailStudioFlowStep[] } {
  const steps: EmailStudioFlowStep[] = []
  let entry: string | null = null
  let previous: EmailStudioFlowStep | null = null
  for (let index = 0; index < proposalSteps.length; index += 1) {
    const proposal = proposalSteps[index]
    if (!proposal) continue
    const id = crypto.randomUUID()
    if (proposal.type === "split") {
      const rest = linkProposalSteps(proposalSteps.slice(index + 1), flowName, triggerMetric, emailProjects)
      const yes = linkProposalSteps(proposal.yes, flowName, triggerMetric, emailProjects)
      const no = linkProposalSteps(proposal.no, flowName, triggerMetric, emailProjects)
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
      const projectId = crypto.randomUUID()
      emailProjects.push({
        id: projectId,
        name: proposal.name || "Flow email",
        subject: proposal.subject,
        previewText: proposal.previewText,
        triggerMetric,
        notes: "",
        document: documentForFlowEmail(proposal),
      })
      step = {
        id,
        type: "email",
        projectId,
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
  flowName: string,
  triggerMetric: string,
): {
  entry: string | null
  steps: EmailStudioFlowStep[]
  emailProjects: ProposedFlowEmailProject[]
} {
  const emailProjects: ProposedFlowEmailProject[] = []
  return {
    ...linkProposalSteps(proposalSteps, flowName, triggerMetric, emailProjects),
    emailProjects,
  }
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
  const lines = options.slice(0, 60).map((option) => `${option.id} | ${option.name}`)
  return lines.length ? `${label}:\n${lines.join("\n")}` : `${label}: none loaded`
}

function providerOptions() {
  return {
    gateway: { tags: gatewayTagsForFeature("email_studio") },
    google: { safetySettings: SAFETY },
  }
}

function isGatewayAuthenticationError(error: unknown): boolean {
  return error instanceof Error
    && (
      error.name === "GatewayAuthenticationError"
      || error.message.includes("Unauthenticated request to AI Gateway")
    )
}

type AssistantOperation =
  | "replace-document"
  | "replace-selection"
  | "insert-after-selection"
  | "metadata-only"

function emailProposalCommands(
  existing: EmailStudioRecord,
  draft: AssistantEmailDraft,
  operation: AssistantOperation,
  metadataFields: ("subject" | "previewText" | "notes")[],
  selectedBlockId?: string,
): EmailStudioEmailCommand[] {
  if (operation === "replace-selection" && selectedBlockId) {
    const selected = findEmailBlock(existing.document, selectedBlockId)?.block
    if (selected) {
      const candidate = draft.document.blocks.find((block) => block.type === selected.type)
        ?? draft.document.blocks.find((block) => block.type !== "logo" && block.type !== "footer")
      if (candidate) {
        return [{
          type: "email.block.replace",
          block: { ...candidate, id: selected.id } as EmailBlock,
        }]
      }
    }
    throw new Error("The assistant could not produce a valid replacement for the selected block.")
  }

  if (operation === "insert-after-selection") {
    const generated = draft.document.blocks.filter(
      (block) => block.type !== "logo" && block.type !== "footer",
    )
    if (generated.length > 0) {
      const selectedIndex = existing.document.blocks.findIndex((block) => block.id === selectedBlockId)
      const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : existing.document.blocks.length
      return generated.map((block, index) => ({
        type: "email.block.insert" as const,
        block,
        index: insertAt + index,
      }))
    }
    throw new Error("The assistant did not produce any blocks to insert.")
  }

  if (operation === "metadata-only") {
    const patch: {
      subject?: string
      previewText?: string
      notes?: string
    } = {}
    if (metadataFields.includes("subject") && draft.subject !== existing.subject) {
      patch.subject = draft.subject
    }
    if (metadataFields.includes("previewText") && draft.previewText !== existing.previewText) {
      patch.previewText = draft.previewText
    }
    if (metadataFields.includes("notes") && draft.notes !== existing.notes) {
      patch.notes = draft.notes
    }
    if (Object.keys(patch).length > 0) {
      return [{ type: "email.meta.patch", patch }]
    }
    throw new Error("The assistant did not return a metadata change.")
  }

  return [
    {
      type: "email.meta.patch",
      patch: {
        subject: draft.subject,
        previewText: draft.previewText,
        notes: draft.notes,
      },
    },
    { type: "email.document.replace", document: draft.document },
  ]
}

function presentStudioDraft(draft: {
  reply: string
  operation: AssistantOperation
  metadataFields: ("subject" | "previewText" | "notes")[]
  email: AssistantEmailDraft | null
  flow: AssistantFlowDraft | null
}) {
  if (!draft.email || draft.operation !== "replace-document") return draft
  return {
    ...draft,
    email: {
      ...draft.email,
      document: designFlatEmailDocument(draft.email.document, { subject: draft.email.subject }),
    },
  }
}

async function draftFromModel(input: {
  prompt: string
  history: { role: "user" | "assistant"; content: string }[]
  images?: AssistantScreenshot[]
}): Promise<{
  reply: string
  operation: "replace-document" | "replace-selection" | "insert-after-selection" | "metadata-only"
  metadataFields: ("subject" | "previewText" | "notes")[]
  email: AssistantEmailDraft | null
  flow: AssistantFlowDraft | null
}> {
  const model = resolveConfiguredModel(feature())
  const images = input.images ?? []
  const messages = [
    ...input.history.slice(-6),
    {
      role: "user" as const,
      content: images.length === 0
        ? input.prompt
        : [
            { type: "text" as const, text: input.prompt },
            ...images.flatMap((image, index) => [
              { type: "text" as const, text: `Screenshot ${index + 1} of ${images.length}.` },
              { type: "file" as const, mediaType: image.mediaType, data: image.bytes },
            ]),
          ],
    },
  ]
  const timeout = images.length > 0 ? 60_000 : 45_000
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: assistantStudioModelSchema }),
      system: SYSTEM,
      messages,
      temperature: 0.2,
      maxOutputTokens: 8000,
      maxRetries: 0,
      timeout,
      providerOptions: providerOptions(),
    })
    const coerced = coerceAssistantStudio(result.output)
    if (!coerced) throw new Error("empty draft")
    return presentStudioDraft(coerced)
  } catch (error) {
    if (isGatewayAuthenticationError(error)) {
      throw new Error(
        "AI Gateway is not authenticated. Set AI_GATEWAY_API_KEY or refresh local Vercel OIDC credentials, then restart the dev server.",
      )
    }
    console.error("[email_studio] structured draft failed", error)
  }

  const fallback = await generateText({
    model,
    system: `${SYSTEM}\n\nReturn one JSON object and no other text.`,
    messages,
    temperature: 0.2,
    maxOutputTokens: 8000,
    maxRetries: 0,
    timeout,
    providerOptions: providerOptions(),
  })
  const json = extractJsonObject(fallback.text)
  const coerced = coerceAssistantStudio(json)
  if (coerced) return presentStudioDraft(coerced)
  const email = coerceAssistantEmail(json)
  const flow = coerceAssistantFlow(json)
  if (email || flow) {
    return presentStudioDraft({
      reply: email?.reply || flow?.reply || "Updated the draft.",
      operation: "replace-document",
      metadataFields: [],
      email: email?.draft ?? null,
      flow,
    })
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
  baseRevision: number
  selectedBlockId?: string
  message: string
  snapshot: string
  images?: AssistantScreenshot[]
}): Promise<
  | {
      success: true
      reply: string
      email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument } | null
      flow: EmailStudioFlowSnapshot | null
      flowId: string | null
      proposalId: string | null
      proposalScope: "email" | "flow" | null
      baseRevision: number
    }
  | { error: string }
> {
  if (!isEmailStudioAssistantEnabled()) {
    return {
      error: "The email assistant needs AI Gateway authentication. Set AI_GATEWAY_API_KEY or pull Vercel OIDC credentials, then restart the dev server.",
    }
  }
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
  const images = input.images ?? []
  await insertEmailStudioMessage(client, {
    scope: input.scope,
    scopeId: input.scopeId,
    role: "user",
    content: assistantTranscriptContent(input.message, images.length),
    userId: user.id,
  })

  let output: {
    reply: string
    operation: "replace-document" | "replace-selection" | "insert-after-selection" | "metadata-only"
    metadataFields: ("subject" | "previewText" | "notes")[]
    email: AssistantEmailDraft | null
    flow: AssistantFlowDraft | null
  }
  try {
    output = await draftFromModel({
      history: history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
      prompt: [
        `Scope: ${input.scope}`,
        input.selectedBlockId ? `Selected block id: ${input.selectedBlockId}` : "No block is selected.",
        `Known metrics: ${KNOWN_KLAVIYO_METRIC_NAMES.join(", ")}`,
        catalogLines("Metrics", catalog.metrics),
        catalogLines("Lists", catalog.lists),
        catalogLines("Segments", catalog.segments),
        "Current draft:",
        input.snapshot.slice(0, 12000),
        assistantScreenshotInstruction(images.length),
        `Request: ${input.message}`,
      ].filter(Boolean).join("\n\n"),
      images,
    })
  } catch (error) {
    console.error("[email_studio] assistant failed", error)
    if (error instanceof Error && error.message.startsWith("AI Gateway is not authenticated")) {
      return { error: error.message }
    }
    return {
      error: images.length > 0
        ? "The assistant could not read that screenshot. Try a clearer image, or describe the layout in words."
        : "The assistant could not draft that. Say what the email or flow should do and try again.",
    }
  }

  let email: { subject: string; previewText: string; notes: string; document: EmailStudioDocument } | null = null
  let flow: EmailStudioFlowSnapshot | null = null
  let flowId: string | null = null
  let proposalId: string | null = null
  let proposalScope: "email" | "flow" | null = null
  try {
    if (output.email && input.scope === "email") {
      const existing = await getEmailStudioDocument(client, input.scopeId)
      if (!existing) return { error: "Email not found" }
      if (existing.revision !== input.baseRevision) {
        return { error: "This email changed while the assistant was drafting. Review the latest version and try again." }
      }
      const commands = emailProposalCommands(
        existing,
        output.email,
        output.operation,
        output.metadataFields,
        input.selectedBlockId,
      )
      const preview = applyEmailStudioEmailCommands(emailStudioEmailSnapshot(existing), commands)
      const proposal = await insertEmailStudioProposal(client, {
        scope: "email",
        scopeId: existing.id,
        baseRevision: existing.revision,
        summary: output.reply.slice(0, 500),
        assistantMessage: output.reply,
        commands,
        userId: user.id,
      })
      proposalId = proposal.id
      proposalScope = "email"
      email = {
        subject: preview.subject,
        previewText: preview.previewText,
        notes: preview.notes,
        document: preview.document,
      }
    }
    if (output.flow) {
      const triggerMetric = output.flow.triggerType === "metric" ? output.flow.triggerName : ""
      const built = chainSteps(output.flow.steps, output.flow.name, triggerMetric)
      const definition = definitionFromProposal(output.flow, built)
      if (input.scope === "flow") {
        const existing = await getEmailStudioFlow(client, input.scopeId)
        if (!existing) return { error: "Flow not found" }
        if (existing.revision !== input.baseRevision) {
          return { error: "This flow changed while the assistant was drafting. Review the latest version and try again." }
        }
        const commands: EmailStudioFlowCommand[] = [
          ...built.emailProjects.map((project) => ({
            type: "flow.email.create" as const,
            projectId: project.id,
            name: project.name,
            subject: project.subject,
            previewText: project.previewText,
            triggerMetric: project.triggerMetric,
            notes: project.notes,
            document: project.document,
          })),
          {
            type: "flow.meta.patch",
            patch: { name: output.flow.name || existing.name, notes: output.flow.notes },
          },
          { type: "flow.definition.replace", definition },
        ]
        const preview = applyEmailStudioFlowCommands(emailStudioFlowSnapshot(existing), commands)
        const proposal = await insertEmailStudioProposal(client, {
          scope: "flow",
          scopeId: existing.id,
          baseRevision: existing.revision,
          summary: output.reply.slice(0, 500),
          assistantMessage: output.reply,
          commands,
          userId: user.id,
        })
        proposalId = proposal.id
        proposalScope = "flow"
        flow = preview
        flowId = existing.id
      } else {
        for (const project of built.emailProjects) {
          await insertEmailStudioDocument(client, {
            id: project.id,
            kind: "project",
            name: project.name,
            subject: project.subject,
            previewText: project.previewText,
            flowName: output.flow.name,
            flowId: "",
            triggerMetric: project.triggerMetric,
            notes: project.notes,
            document: project.document,
            userId: user.id,
            source: "assistant",
            summary: `Created for ${output.flow.name}`,
          })
        }
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
  return {
    success: true,
    reply: output.reply,
    email,
    flow,
    flowId,
    proposalId,
    proposalScope,
    baseRevision: input.baseRevision,
  }
}

export async function generateEmailStudioFromBriefService(input: GenerateEmailStudioInput): Promise<
  | { success: true; target: "email" | "flow"; id: string; name: string }
  | { error: string }
> {
  if (!isEmailStudioAssistantEnabled()) {
    return {
      error: "The email assistant needs AI Gateway authentication. Set AI_GATEWAY_API_KEY or pull Vercel OIDC credentials, then restart the dev server.",
    }
  }
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
  const catalog = await listKlaviyoFlowCatalogService()
  const preferredName = input.name?.trim() ?? ""
  const request = "brief" in input
    ? input.brief
    : buildStructuredEmailBrief(input)
  let output: {
    reply: string
    operation: AssistantOperation
    metadataFields: ("subject" | "previewText" | "notes")[]
    email: AssistantEmailDraft | null
    flow: AssistantFlowDraft | null
  }
  try {
    output = await draftFromModel({
      history: [],
      prompt: [
        input.target === "flow"
          ? "Build a complete draft flow. applyFlow is yes. applyEmail is no. Every email step needs layout, eyebrow, heading, body, buttonLabel, and buttonHref. Vary layouts across the sequence so each send looks designed."
          : "Build one designed email. applyEmail is yes. applyFlow is no. operation is replace-document. Use logo, at least two sections with different surfaces, and a footer.",
        `Known metrics: ${KNOWN_KLAVIYO_METRIC_NAMES.join(", ")}`,
        catalogLines("Metrics", catalog.metrics),
        catalogLines("Lists", catalog.lists),
        catalogLines("Segments", catalog.segments),
        preferredName ? `Preferred name: ${preferredName}` : "",
        `Request: ${request}`,
      ].filter(Boolean).join("\n\n"),
    })
  } catch (error) {
    console.error("[email_studio] generate failed", error)
    if (error instanceof Error && error.message.startsWith("AI Gateway is not authenticated")) {
      return { error: error.message }
    }
    return { error: "The assistant could not design that. Describe the email or flow in a sentence and try again." }
  }

  try {
    if (input.target === "email") {
      if (!output.email) return { error: "The assistant did not return an email. Describe the message and try again." }
      const name = (preferredName || output.email.name || "Untitled email").slice(0, 120)
      const created = await insertEmailStudioDocument(client, {
        kind: "project",
        name,
        subject: output.email.subject,
        previewText: output.email.previewText,
        flowName: "",
        flowId: "",
        triggerMetric: "",
        notes: output.email.notes,
        document: output.email.document,
        userId: user.id,
        source: "assistant",
        summary: "Generated from a brief",
      })
      await insertEmailStudioMessage(client, {
        scope: "email",
        scopeId: created.id,
        role: "user",
        content: request,
        userId: user.id,
      })
      await insertEmailStudioMessage(client, {
        scope: "email",
        scopeId: created.id,
        role: "assistant",
        content: output.reply,
        userId: null,
      })
      return { success: true, target: "email", id: created.id, name: created.name }
    }

    if (!output.flow) return { error: "The assistant did not return a flow. Describe the sequence and try again." }
    const triggerMetric = output.flow.triggerType === "metric" ? output.flow.triggerName : ""
    const built = chainSteps(output.flow.steps, output.flow.name, triggerMetric)
    const definition = definitionFromProposal(output.flow, built)
    for (const project of built.emailProjects) {
      await insertEmailStudioDocument(client, {
        id: project.id,
        kind: "project",
        name: project.name,
        subject: project.subject,
        previewText: project.previewText,
        flowName: output.flow.name,
        flowId: "",
        triggerMetric: project.triggerMetric,
        notes: project.notes,
        document: project.document,
        userId: user.id,
        source: "assistant",
        summary: `Generated for ${output.flow.name}`,
      })
    }
    const created = await insertEmailStudioFlow(client, {
      name: (preferredName || output.flow.name || "Untitled flow").slice(0, 120),
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
    await insertEmailStudioMessage(client, {
      scope: "flow",
      scopeId: created.id,
      role: "user",
      content: request,
      userId: user.id,
    })
    await insertEmailStudioMessage(client, {
      scope: "flow",
      scopeId: created.id,
      role: "assistant",
      content: output.reply,
      userId: null,
    })
    return { success: true, target: "flow", id: created.id, name: created.name }
  } catch (error) {
    console.error("[email_studio] save generated draft failed", error)
    const message = error instanceof Error ? error.message : ""
    if (message.startsWith("The draft")) return { error: message }
    return { error: "Could not save that design." }
  }
}
