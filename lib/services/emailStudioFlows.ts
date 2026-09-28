import "server-only"

import { createHash } from "node:crypto"
import { getKlaviyoApiKey, klaviyoGetAllPages, klaviyoWrite } from "@/lib/klaviyo/api-client"
import { compileKlaviyoFlow } from "@/lib/email-studio/compile-klaviyo-flow"
import { blankFlowDefinition, walkFlowSteps } from "@/lib/email-studio/flow-definition"
import { planFlowReplacement } from "@/lib/email-studio/flow-replacement"
import {
  deleteEmailStudioFlow,
  getEmailStudioFlow,
  insertEmailStudioFlow,
  listEmailStudioFlows,
  updateEmailStudioFlow,
  updateEmailStudioFlowKlaviyoSync,
} from "@/lib/db/emailStudioFlows"
import {
  getEmailStudioDocument,
  getEmailStudioDocumentsByIds,
} from "@/lib/db/emailStudio"
import { pushEmailStudioToKlaviyoService } from "@/lib/services/emailStudio"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type {
  EmailStudioFlowRecord,
  EmailStudioFlowStep,
  KlaviyoCatalogOption,
} from "@/lib/types/emailStudioFlow"
import type { UpdateEmailStudioFlowInput } from "@/lib/validations/emailStudioFlow"

type ServiceError = { error: string }

async function requireStaff(): Promise<
  | { ok: false; error: string }
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Unauthorized" }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile || (profile.is_admin !== true && profile.is_employee !== true)) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, userId: user.id, supabase }
}

function dbClient(userClient: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServiceRoleClient()
  } catch {
    return userClient
  }
}

export async function listEmailStudioFlowsService(): Promise<
  { success: true; data: EmailStudioFlowRecord[] } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    return { success: true, data: await listEmailStudioFlows(dbClient(staff.supabase)) }
  } catch (error) {
    console.error("[email_studio] list flows failed", error)
    return { error: "Could not load flows" }
  }
}

export async function getEmailStudioFlowService(
  id: string,
): Promise<{
  success: true
  data: EmailStudioFlowRecord
  linkedProjects: Awaited<ReturnType<typeof getEmailStudioDocumentsByIds>>
} | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await getEmailStudioFlow(dbClient(staff.supabase), id)
    if (!data) return { error: "Flow not found" }
    const linkedIds = data.definition.steps.flatMap((step) => (
      step.type === "email" && step.projectId ? [step.projectId] : []
    ))
    const linkedProjects = await getEmailStudioDocumentsByIds(
      dbClient(staff.supabase),
      linkedIds,
    )
    return { success: true, data, linkedProjects }
  } catch (error) {
    console.error("[email_studio] get flow failed", error)
    return { error: "Could not load this flow" }
  }
}

export async function createEmailStudioFlowService(
  name: string,
): Promise<{ success: true; data: EmailStudioFlowRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await insertEmailStudioFlow(dbClient(staff.supabase), {
      name,
      definition: blankFlowDefinition(),
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] create flow failed", error)
    return { error: "Could not create this flow" }
  }
}

export async function updateEmailStudioFlowService(
  input: UpdateEmailStudioFlowInput,
): Promise<{ success: true; data: EmailStudioFlowRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    walkFlowSteps(input.definition)
    const data = await updateEmailStudioFlow(dbClient(staff.supabase), {
      ...input,
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] update flow failed", error)
    if (error instanceof Error && error.message.startsWith("This flow")) return { error: error.message }
    if (error instanceof Error && error.message.startsWith("A flow step")) return { error: error.message }
    return { error: "Could not save this flow" }
  }
}

export async function deleteEmailStudioFlowService(id: string): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    await deleteEmailStudioFlow(dbClient(staff.supabase), id)
    return { success: true }
  } catch (error) {
    console.error("[email_studio] delete flow failed", error)
    return { error: "Could not delete this flow" }
  }
}

async function catalog(path: string, resource: "metric" | "list" | "segment"): Promise<KlaviyoCatalogOption[]> {
  const result = await klaviyoGetAllPages<{ id: string; attributes?: { name?: string } }>(path, {
    [`fields[${resource}]`]: "name",
    "page[size]": "50",
  }, { maxPages: 20 })
  if (!result.ok) return []
  return result.data
    .map((item) => ({ id: item.id, name: item.attributes?.name?.trim() || item.id }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function listKlaviyoFlowCatalogService(): Promise<{
  connected: boolean
  metrics: KlaviyoCatalogOption[]
  lists: KlaviyoCatalogOption[]
  segments: KlaviyoCatalogOption[]
}> {
  const staff = await requireStaff()
  if (!staff.ok || !getKlaviyoApiKey()) {
    return { connected: false, metrics: [], lists: [], segments: [] }
  }
  const [metrics, lists, segments] = await Promise.all([
    catalog("/api/metrics/", "metric"),
    catalog("/api/lists/", "list"),
    catalog("/api/segments/", "segment"),
  ])
  return { connected: true, metrics, lists, segments }
}

type KlaviyoFlowActionResource = {
  id: string
  attributes?: {
    action_type?: string
    definition?: Record<string, unknown>
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

async function syncExistingFlowEmailActions(input: {
  flowId: string
  steps: EmailStudioFlowStep[]
  templateIds: Map<string, string>
  subjects: Map<string, { subject: string; preview: string; name: string }>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetched = await klaviyoGetAllPages<KlaviyoFlowActionResource>(
    `/api/flows/${input.flowId}/flow-actions/`,
    {
      "fields[flow-action]": "action_type,definition",
      "page[size]": "50",
    },
    { maxPages: 2 },
  )
  if (!fetched.ok) return { ok: false, error: fetched.detail }
  const remoteEmails = fetched.data.filter((action) => {
    const definition = action.attributes?.definition
    const data = record(definition?.data)
    return action.attributes?.action_type === "SEND_EMAIL"
      || definition?.type === "send-email"
      || Boolean(record(data?.message))
  })
  const localEmails = input.steps.filter(
    (step): step is Extract<EmailStudioFlowStep, { type: "email" }> => step.type === "email",
  )
  if (remoteEmails.length !== localEmails.length) {
    return {
      ok: false,
      error: `Klaviyo has ${remoteEmails.length} email actions; the studio has ${localEmails.length}.`,
    }
  }
  const unused = new Set(remoteEmails.map((action) => action.id))
  for (const step of localEmails) {
    const templateId = input.templateIds.get(step.projectId)
    const copy = input.subjects.get(step.projectId)
    if (!templateId || !copy) return { ok: false, error: "A linked email is missing its template metadata." }
    const available = remoteEmails.filter((candidate) => unused.has(candidate.id))
    const messageFor = (candidate: KlaviyoFlowActionResource) =>
      record(record(candidate.attributes?.definition?.data)?.message)
    const marked = available.filter((candidate) => (
      String(messageFor(candidate)?.name ?? "").includes(`RS ${step.id}`)
    ))
    const byTemplateAndName = available.filter((candidate) => {
      const message = messageFor(candidate)
      return message?.template_id === templateId
        && String(message?.name ?? "").replace(/ · RS .+$/, "") === copy.name
    })
    const byTemplate = available.filter((candidate) => messageFor(candidate)?.template_id === templateId)
    const byName = available.filter((candidate) => (
      String(messageFor(candidate)?.name ?? "").replace(/ · RS .+$/, "") === copy.name
    ))
    const candidates = marked.length
      ? marked
      : byTemplateAndName.length
        ? byTemplateAndName
        : byTemplate.length
          ? byTemplate
          : byName
    if (candidates.length !== 1) {
      return {
        ok: false,
        error: `Could not uniquely match the ${copy.name} action in Klaviyo. Create a replacement draft.`,
      }
    }
    const action = candidates[0]
    if (!action) return { ok: false, error: `Could not match the ${copy.name} action in Klaviyo.` }
    unused.delete(action.id)
    const definition = action.attributes?.definition
    const data = record(definition?.data)
    const message = record(data?.message)
    if (!definition || !data || !message) {
      return { ok: false, error: `Klaviyo returned an unreadable definition for ${copy.name}.` }
    }
    const updated = await klaviyoWrite(
      "PATCH",
      `/api/flow-actions/${action.id}/`,
      {
        data: {
          type: "flow-action",
          id: action.id,
          attributes: {
            definition: {
              ...definition,
              data: {
                ...data,
                message: {
                  ...message,
                  from_email: step.fromEmail,
                  from_label: step.fromLabel,
                  subject_line: copy.subject || "Reswell",
                  preview_text: copy.preview,
                  template_id: templateId,
                  smart_sending_enabled: step.smartSending,
                  transactional: step.transactional,
                  name: `${copy.name} · RS ${step.id}`.slice(0, 255),
                },
              },
            },
          },
        },
      },
    )
    if (!updated.ok) return { ok: false, error: updated.detail }
  }
  return { ok: true }
}

export async function pushEmailStudioFlowService(
  id: string,
  replace = false,
): Promise<{
  success: true
  klaviyoFlowId: string
  replacedId: string | null
  syncedRevision: number | null
  checksum: string | null
  syncedAt: string | null
  warning: string | null
} | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const flow = await getEmailStudioFlow(client, id)
    if (!flow) return { error: "Flow not found" }
    if (
      flow.klaviyoFlowId
      && !replace
      && flow.klaviyoSyncedRevision !== flow.revision
    ) {
      return { error: "This flow structure changed. Push an updated draft to keep the current Klaviyo flow untouched." }
    }
    const steps = walkFlowSteps(flow.definition)
    const templateIds = new Map<string, string>()
    const subjects = new Map<string, { subject: string; preview: string; name: string }>()
    for (const step of steps) {
      if (step.type !== "email" || templateIds.has(step.projectId)) continue
      if (!step.projectId) return { error: "Choose an email for every email action." }
      let project = await getEmailStudioDocument(client, step.projectId)
      if (!project) return { error: "An email in this flow no longer exists." }
      let templateId = project.klaviyoTemplateId
      if (!templateId || project.klaviyoSyncedRevision !== project.revision) {
        const pushed = await pushEmailStudioToKlaviyoService(step.projectId)
        if ("error" in pushed) return pushed
        templateId = pushed.templateId
      }
      templateIds.set(step.projectId, templateId)
      subjects.set(step.projectId, {
        subject: project.subject,
        preview: project.previewText,
        name: project.name,
      })
    }
    const compiled = compileKlaviyoFlow({
      name: flow.name,
      definition: flow.definition,
      templateIds,
      subjects,
    })
    const checksum = createHash("sha256")
      .update(JSON.stringify({ name: flow.name, definition: compiled.definition }))
      .digest("hex")
    if (flow.klaviyoFlowId && !replace) {
      const actionSync = await syncExistingFlowEmailActions({
        flowId: flow.klaviyoFlowId,
        steps,
        templateIds,
        subjects,
      })
      if (!actionSync.ok) {
        return { error: `Linked templates were updated, but flow messages were not: ${actionSync.error}` }
      }
      const verified = await klaviyoGetAllPages<{ id: string }>(
        `/api/flows/${flow.klaviyoFlowId}/flow-actions/`,
        { "page[size]": "50" },
        { maxPages: 2 },
      )
      const warning = !verified.ok
        ? `Linked emails synced, but flow verification failed: ${verified.detail}`
        : verified.data.length !== steps.length
          ? `Linked emails synced; Klaviyo has ${verified.data.length} actions and the studio has ${steps.length}.`
          : null
      const syncedAt = new Date().toISOString()
      await updateEmailStudioFlowKlaviyoSync(client, {
        id: flow.id,
        flowId: flow.klaviyoFlowId,
        status: flow.klaviyoStatus,
        syncedRevision: warning ? null : flow.revision,
        contentChecksum: warning ? null : checksum,
        syncedAt: warning ? null : syncedAt,
        userId: staff.userId,
      })
      return {
        success: true,
        klaviyoFlowId: flow.klaviyoFlowId,
        replacedId: null,
        syncedRevision: warning ? null : flow.revision,
        checksum: warning ? null : checksum,
        syncedAt: warning ? null : syncedAt,
        warning,
      }
    }
    const created = await klaviyoWrite<{ data?: { id?: string } }>(
      "POST",
      "/api/flows/?additional-fields[flow]=definition",
      {
        data: {
          type: "flow",
          attributes: { name: flow.name.slice(0, 255), definition: compiled.definition },
        },
      },
    )
    if (!created.ok) return { error: created.detail || "Klaviyo rejected the flow" }
    const klaviyoFlowId = created.data.data?.id
    if (!klaviyoFlowId) return { error: "Klaviyo created the flow without an id" }
    const verified = await klaviyoGetAllPages<{ id: string }>(
      `/api/flows/${klaviyoFlowId}/flow-actions/`,
      { "page[size]": "50" },
      { maxPages: 2 },
    )
    const warning = !verified.ok
      ? `Flow created, but verification failed: ${verified.detail}`
      : verified.data.length !== steps.length
        ? `Flow created with ${verified.data.length} verified actions; expected ${steps.length}.`
        : null
    const syncedAt = new Date().toISOString()
    const replacement = planFlowReplacement({
      currentFlowId: flow.klaviyoFlowId,
      currentStatus: flow.klaviyoStatus,
      protectedFlowId: flow.klaviyoReplacedFlowId,
      protectedFlowStatus: flow.klaviyoReplacedFlowStatus,
    })
    if (
      replace
      && replacement.intermediateFlowIdToDisable
    ) {
      const disabledIntermediate = await klaviyoWrite(
        "PATCH",
        `/api/flows/${replacement.intermediateFlowIdToDisable}/`,
        {
          data: {
            type: "flow",
            id: replacement.intermediateFlowIdToDisable,
            attributes: { status: "draft" },
          },
        },
      )
      if (!disabledIntermediate.ok) {
        return {
          error: `The replacement draft was created, but the intermediate manual flow could not be disabled: ${disabledIntermediate.detail}`,
        }
      }
    }
    const replacedFlowId = replace
      ? replacement.protectedFlowId
      : null
    const replacedFlowStatus = replace
      ? replacement.protectedFlowStatus
      : null
    await updateEmailStudioFlowKlaviyoSync(client, {
      id: flow.id,
      flowId: klaviyoFlowId,
      status: "draft",
      syncedRevision: warning ? null : flow.revision,
      contentChecksum: warning ? null : checksum,
      syncedAt: warning ? null : syncedAt,
      replacedFlowId,
      replacedFlowStatus,
      userId: staff.userId,
    })
    return {
      success: true,
      klaviyoFlowId,
      replacedId: replace ? flow.klaviyoFlowId : null,
      syncedRevision: warning ? null : flow.revision,
      checksum: warning ? null : checksum,
      syncedAt: warning ? null : syncedAt,
      warning,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not push this flow"
    console.error("[email_studio] push flow failed", error)
    return { error: message }
  }
}

export async function setEmailStudioFlowStatusService(
  id: string,
  status: "draft" | "manual" | "live",
  confirmLive = false,
): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  if (status === "live" && !confirmLive) {
    return { error: "Confirm before setting this flow live." }
  }
  try {
    const client = dbClient(staff.supabase)
    const flow = await getEmailStudioFlow(client, id)
    if (!flow?.klaviyoFlowId) return { error: "Push the flow to Klaviyo first." }
    if (status !== "draft" && flow.klaviyoSyncedRevision !== flow.revision) {
      return { error: "Push and verify the latest flow version before changing its Klaviyo status." }
    }
    if (status !== "draft") {
      const steps = walkFlowSteps(flow.definition)
      const templateIds = new Map<string, string>()
      const subjects = new Map<string, { subject: string; preview: string; name: string }>()
      for (const step of steps) {
        if (step.type !== "email" || templateIds.has(step.projectId)) continue
        const project = await getEmailStudioDocument(client, step.projectId)
        if (
          !project?.klaviyoTemplateId
          || project.klaviyoSyncedRevision !== project.revision
        ) {
          return { error: "Sync every linked email before changing this flow's Klaviyo status." }
        }
        templateIds.set(step.projectId, project.klaviyoTemplateId)
        subjects.set(step.projectId, {
          subject: project.subject,
          preview: project.previewText,
          name: project.name,
        })
      }
      const compiled = compileKlaviyoFlow({
        name: flow.name,
        definition: flow.definition,
        templateIds,
        subjects,
      })
      const currentChecksum = createHash("sha256")
        .update(JSON.stringify({ name: flow.name, definition: compiled.definition }))
        .digest("hex")
      if (currentChecksum !== flow.klaviyoContentChecksum) {
        return { error: "Linked email content changed. Sync linked emails before changing this flow's status." }
      }
    }
    const previousStatus =
      flow.klaviyoReplacedFlowStatus === "live" || flow.klaviyoReplacedFlowStatus === "manual"
        ? flow.klaviyoReplacedFlowStatus
        : null
    let previousDisabled = false
    if (status === "live" && flow.klaviyoReplacedFlowId && previousStatus) {
      const disabled = await klaviyoWrite(
        "PATCH",
        `/api/flows/${flow.klaviyoReplacedFlowId}/`,
        {
          data: {
            type: "flow",
            id: flow.klaviyoReplacedFlowId,
            attributes: { status: "draft" },
          },
        },
      )
      if (!disabled.ok) {
        return { error: `Could not disable the previous ${previousStatus} flow: ${disabled.detail}` }
      }
      previousDisabled = true
    }
    const updated = await klaviyoWrite(
      "PATCH",
      `/api/flows/${flow.klaviyoFlowId}/`,
      {
        data: {
          type: "flow",
          id: flow.klaviyoFlowId,
          attributes: { status },
        },
      },
    )
    if (!updated.ok) {
      if (previousDisabled && flow.klaviyoReplacedFlowId && previousStatus) {
        await klaviyoWrite(
          "PATCH",
          `/api/flows/${flow.klaviyoReplacedFlowId}/`,
          {
            data: {
              type: "flow",
              id: flow.klaviyoReplacedFlowId,
              attributes: { status: previousStatus },
            },
          },
        )
      }
      return { error: updated.detail || "Klaviyo rejected the status change" }
    }
    await updateEmailStudioFlowKlaviyoSync(client, {
      id: flow.id,
      flowId: flow.klaviyoFlowId,
      status,
      syncedRevision: flow.klaviyoSyncedRevision,
      contentChecksum: flow.klaviyoContentChecksum,
      syncedAt: flow.klaviyoSyncedAt,
      replacedFlowId: previousDisabled ? null : flow.klaviyoReplacedFlowId,
      replacedFlowStatus: previousDisabled ? null : flow.klaviyoReplacedFlowStatus,
      userId: staff.userId,
    })
    return { success: true }
  } catch (error) {
    console.error("[email_studio] flow status failed", error)
    return { error: "Could not update the flow status" }
  }
}
