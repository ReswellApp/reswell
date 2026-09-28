import "server-only"

import { createHash } from "node:crypto"
import {
  getKlaviyoApiKey,
  klaviyoGet,
  klaviyoGetAllPages,
  klaviyoWrite,
} from "@/lib/klaviyo/api-client"
import { compileKlaviyoFlow } from "@/lib/email-studio/compile-klaviyo-flow"
import { blankFlowDefinition, walkFlowSteps } from "@/lib/email-studio/flow-definition"
import {
  importKlaviyoFlowDefinition,
  supportedKlaviyoActionType,
  type KlaviyoRemoteAction,
} from "@/lib/email-studio/import-klaviyo-flow"
import { planFlowReplacement } from "@/lib/email-studio/flow-replacement"
import {
  deleteEmailStudioFlow,
  getEmailStudioFlow,
  getEmailStudioFlowByKlaviyoId,
  insertEmailStudioFlow,
  listEmailStudioFlows,
  updateEmailStudioFlow,
  updateEmailStudioFlowKlaviyoSync,
} from "@/lib/db/emailStudioFlows"
import {
  deleteEmailStudioDocument,
  getEmailStudioDocument,
  getEmailStudioDocumentsByIds,
  insertEmailStudioDocument,
} from "@/lib/db/emailStudio"
import { pushEmailStudioToKlaviyoService } from "@/lib/services/emailStudio"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type {
  EmailStudioFlowRecord,
  EmailStudioFlowStep,
  KlaviyoCatalogOption,
  KlaviyoFlowWorkspaceItem,
  KlaviyoMetricWorkspaceItem,
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

type KlaviyoFlowResource = {
  id: string
  attributes?: {
    name?: string
    status?: string
    archived?: boolean
    updated?: string
    definition?: Record<string, unknown>
  }
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function objectList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => object(item) !== null)
    : []
}

function actionType(value: unknown): string {
  const action = object(value)
  const raw = typeof action?.type === "string" ? action.type : ""
  return raw.toLowerCase().replaceAll("_", "-")
}

function triggerSummary(
  definition: Record<string, unknown> | null,
  names: {
    metrics: Map<string, string>
    lists: Map<string, string>
    segments: Map<string, string>
  },
): { name: string; type: string; id: string } {
  const trigger = objectList(definition?.triggers)[0]
  const type = typeof trigger?.type === "string" ? trigger.type : "unknown"
  const id = typeof trigger?.id === "string" ? trigger.id : ""
  const name = type === "metric"
    ? names.metrics.get(id)
    : type === "list"
      ? names.lists.get(id)
      : type === "segment"
        ? names.segments.get(id)
        : type === "date"
          ? String(trigger?.date_profile_property ?? "Profile date")
          : null
  return { name: name || id || "Unknown trigger", type, id }
}

export async function getEmailStudioWorkspaceService(): Promise<{
  connected: boolean
  flows: KlaviyoFlowWorkspaceItem[]
  metrics: KlaviyoMetricWorkspaceItem[]
  error: string | null
}> {
  const staff = await requireStaff()
  if (!staff.ok || !getKlaviyoApiKey()) {
    return { connected: false, flows: [], metrics: [], error: staff.ok ? "Klaviyo is not connected." : staff.error }
  }
  try {
    const [remoteFlows, catalogData, localFlows] = await Promise.all([
      klaviyoGetAllPages<KlaviyoFlowResource>(
        "/api/flows/",
        {
          "additional-fields[flow]": "definition",
          "page[size]": "50",
        },
        { maxPages: 20 },
      ),
      listKlaviyoFlowCatalogService(),
      listEmailStudioFlows(dbClient(staff.supabase)),
    ])
    if (!remoteFlows.ok) {
      return {
        connected: true,
        flows: [],
        metrics: [],
        error: `Could not load Klaviyo flows: ${remoteFlows.detail}`,
      }
    }
    const metricNames = new Map(catalogData.metrics.map((item) => [item.id, item.name]))
    const listNames = new Map(catalogData.lists.map((item) => [item.id, item.name]))
    const segmentNames = new Map(catalogData.segments.map((item) => [item.id, item.name]))
    const localByRemoteId = new Map(
      localFlows.flatMap((flow) => flow.klaviyoFlowId ? [[flow.klaviyoFlowId, flow.id] as const] : []),
    )
    const metricCounts = new Map<string, number>()
    const remoteItems = remoteFlows.data
      .filter((flow) => flow.attributes?.archived !== true)
      .map((flow): KlaviyoFlowWorkspaceItem => {
        const definition = object(flow.attributes?.definition)
        const actions = objectList(definition?.actions)
        const trigger = triggerSummary(definition, {
          metrics: metricNames,
          lists: listNames,
          segments: segmentNames,
        })
        if (trigger.type === "metric" && trigger.id) {
          metricCounts.set(trigger.id, (metricCounts.get(trigger.id) ?? 0) + 1)
        }
        const types = actions.map(actionType)
        return {
          id: flow.id,
          name: flow.attributes?.name?.trim() || "Untitled flow",
          status: flow.attributes?.status?.trim() || "unknown",
          triggerName: trigger.name,
          triggerType: trigger.type,
          actionCount: actions.length,
          emailCount: types.filter((type) => type === "send-email").length,
          updatedAt: flow.attributes?.updated ?? null,
          localFlowId: localByRemoteId.get(flow.id) ?? null,
          unsupportedActions: [...new Set(types.filter((type) => !supportedKlaviyoActionType(type)))],
        }
      })
    const localOnlyItems = localFlows
      .filter((flow) => !flow.klaviyoFlowId)
      .map((flow): KlaviyoFlowWorkspaceItem => {
        const trigger = flow.definition.trigger
        const triggerName = trigger.type === "metric"
          ? trigger.metricName
          : trigger.type === "list"
            ? trigger.listName
            : trigger.type === "segment"
              ? trigger.segmentName
              : trigger.property
        return {
          id: `local:${flow.id}`,
          name: flow.name,
          status: "draft",
          triggerName: triggerName || "Choose a trigger",
          triggerType: trigger.type,
          actionCount: flow.definition.steps.length,
          emailCount: flow.definition.steps.filter((step) => step.type === "email").length,
          updatedAt: flow.updatedAt,
          localFlowId: flow.id,
          unsupportedActions: [],
        }
      })
    const flows = [...remoteItems, ...localOnlyItems]
      .sort((a, b) => (
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
        || a.name.localeCompare(b.name)
      ))
    return {
      connected: true,
      flows,
      metrics: catalogData.metrics
        .map((metric) => ({ ...metric, flowCount: metricCounts.get(metric.id) ?? 0 }))
        .sort((a, b) => b.flowCount - a.flowCount || a.name.localeCompare(b.name)),
      error: null,
    }
  } catch (error) {
    console.error("[email_studio] workspace failed", error)
    return { connected: true, flows: [], metrics: [], error: "Could not load the Klaviyo workspace." }
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

type KlaviyoTemplateResource = {
  data?: {
    id?: string
    attributes?: {
      name?: string
      html?: string
      text?: string
    }
  }
}

export async function openKlaviyoFlowInStudioService(
  klaviyoFlowId: string,
): Promise<{ success: true; flowId: string; imported: boolean } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  const client = dbClient(staff.supabase)
  const createdProjectIds: string[] = []
  try {
    const existing = await getEmailStudioFlowByKlaviyoId(client, klaviyoFlowId)
    if (existing) return { success: true, flowId: existing.id, imported: false }

    const [remoteFlow, remoteActions, catalogData] = await Promise.all([
      klaviyoGet<{ data?: KlaviyoFlowResource }>(
        `/api/flows/${klaviyoFlowId}/`,
        { "additional-fields[flow]": "definition" },
      ),
      klaviyoGetAllPages<KlaviyoFlowActionResource>(
        `/api/flows/${klaviyoFlowId}/flow-actions/`,
        {
          "fields[flow-action]": "action_type,definition",
          "page[size]": "50",
        },
        { maxPages: 4 },
      ),
      listKlaviyoFlowCatalogService(),
    ])
    if (!remoteFlow.ok) return { error: `Could not load this Klaviyo flow: ${remoteFlow.detail}` }
    if (!remoteActions.ok) return { error: `Could not load this flow's actions: ${remoteActions.detail}` }
    const flowResource = remoteFlow.data.data
    if (!flowResource) return { error: "Klaviyo returned an empty flow." }
    const remoteDefinition = object(flowResource.attributes?.definition)
    if (!remoteDefinition) return { error: "Klaviyo did not return an editable flow definition." }

    const imported = importKlaviyoFlowDefinition({
      definition: remoteDefinition,
      actions: remoteActions.data.map((action): KlaviyoRemoteAction => ({
        id: action.id,
        actionType: action.attributes?.action_type,
        definition: action.attributes?.definition,
      })),
      metricNames: new Map(catalogData.metrics.map((item) => [item.id, item.name])),
      listNames: new Map(catalogData.lists.map((item) => [item.id, item.name])),
      segmentNames: new Map(catalogData.segments.map((item) => [item.id, item.name])),
    })
    if (imported.unsupportedActions.length > 0) {
      return {
        error: `This flow uses actions the studio cannot safely edit yet: ${imported.unsupportedActions.join(", ")}.`,
      }
    }
    walkFlowSteps(imported.definition)

    const templates = await Promise.all(imported.emails.map(async (email) => {
      const result = await klaviyoGet<KlaviyoTemplateResource>(
        `/api/templates/${email.templateId}/`,
        { "fields[template]": "name,html,text" },
      )
      if (!result.ok || !result.data.data?.attributes?.html) {
        throw new Error(`Could not import the template for ${email.name}.`)
      }
      return { email, resource: result.data.data }
    }))
    const syncedAt = new Date().toISOString()
    const triggerMetric = imported.definition.trigger.type === "metric"
      ? imported.definition.trigger.metricName
      : ""
    for (const { email, resource } of templates) {
      const attributes = resource.attributes ?? {}
      const html = attributes.html ?? ""
      const checksum = createHash("sha256")
        .update(JSON.stringify({
          name: attributes.name ?? email.name,
          html,
          text: attributes.text ?? "",
        }))
        .digest("hex")
      await insertEmailStudioDocument(client, {
        id: email.projectId,
        kind: "project",
        name: email.name,
        subject: email.subject,
        previewText: email.previewText,
        flowName: flowResource.attributes?.name ?? "Klaviyo flow",
        flowId: klaviyoFlowId,
        triggerMetric,
        notes: "Imported from Klaviyo.",
        document: { blocks: [], htmlOverride: html },
        userId: staff.userId,
        source: "system",
        summary: "Imported from Klaviyo",
        klaviyoTemplateId: email.templateId,
        klaviyoSyncedRevision: 1,
        klaviyoContentChecksum: checksum,
        klaviyoSyncedAt: syncedAt,
      })
      createdProjectIds.push(email.projectId)
    }

    const status = flowResource.attributes?.status === "live"
      || flowResource.attributes?.status === "manual"
      ? flowResource.attributes.status
      : "draft"
    const created = await insertEmailStudioFlow(client, {
      name: flowResource.attributes?.name?.trim() || "Imported Klaviyo flow",
      definition: imported.definition,
      userId: staff.userId,
      source: "system",
      summary: "Imported from Klaviyo",
      klaviyoFlowId,
      klaviyoStatus: status,
    })
    const templateIds = new Map(imported.emails.map((email) => [email.projectId, email.templateId]))
    const subjects = new Map(imported.emails.map((email) => [
      email.projectId,
      { subject: email.subject, preview: email.previewText, name: email.name },
    ]))
    const compiled = compileKlaviyoFlow({
      name: created.name,
      definition: imported.definition,
      templateIds,
      subjects,
    })
    const checksum = createHash("sha256")
      .update(JSON.stringify({ name: created.name, definition: compiled.definition }))
      .digest("hex")
    await updateEmailStudioFlowKlaviyoSync(client, {
      id: created.id,
      flowId: klaviyoFlowId,
      status,
      syncedRevision: created.revision,
      contentChecksum: checksum,
      syncedAt,
      userId: staff.userId,
    })
    return { success: true, flowId: created.id, imported: true }
  } catch (error) {
    await Promise.all(createdProjectIds.map(async (id) => {
      try {
        await deleteEmailStudioDocument(client, id)
      } catch {
        // Preserve the original import error.
      }
    }))
    const message = error instanceof Error ? error.message : "Could not import this flow"
    console.error("[email_studio] import Klaviyo flow failed", error)
    return { error: message }
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

export async function publishEmailStudioFlowService(
  id: string,
  confirmLive: boolean,
): Promise<{
  success: true
  klaviyoFlowId: string
  syncedRevision: number | null
  checksum: string | null
  syncedAt: string | null
  warning: string | null
} | ServiceError> {
  if (!confirmLive) return { error: "Confirm before publishing this flow." }
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const flow = await getEmailStudioFlow(dbClient(staff.supabase), id)
    if (!flow) return { error: "Flow not found" }
    const replace = Boolean(
      flow.klaviyoFlowId && flow.klaviyoSyncedRevision !== flow.revision,
    )
    const pushed = await pushEmailStudioFlowService(id, replace)
    if ("error" in pushed) return pushed
    if (pushed.warning) {
      return {
        error: `The Klaviyo draft was created, but it was not published because verification failed: ${pushed.warning}`,
      }
    }
    const activated = await setEmailStudioFlowStatusService(id, "live", true)
    if ("error" in activated) return activated
    if (activated.status !== "live") {
      return { error: `Klaviyo kept the flow in ${activated.status} instead of publishing it.` }
    }
    return {
      success: true,
      klaviyoFlowId: pushed.klaviyoFlowId,
      syncedRevision: pushed.syncedRevision,
      checksum: pushed.checksum,
      syncedAt: pushed.syncedAt,
      warning: activated.warning,
    }
  } catch (error) {
    console.error("[email_studio] publish flow failed", error)
    return { error: "Could not publish this flow." }
  }
}

export async function setEmailStudioFlowStatusService(
  id: string,
  status: "draft" | "manual" | "live",
  confirmLive = false,
): Promise<{
  success: true
  status: "draft" | "manual" | "live"
  warning: string | null
} | ServiceError> {
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
    const verified = await klaviyoGet<{
      data?: { attributes?: { status?: string } }
    }>(`/api/flows/${flow.klaviyoFlowId}/`, {
      "fields[flow]": "status",
    })
    const readStatus = verified.ok ? verified.data.data?.attributes?.status : null
    const verifiedStatus =
      readStatus === "draft" || readStatus === "manual" || readStatus === "live"
        ? readStatus
        : status
    const warning = !verified.ok
      ? `Klaviyo accepted ${status}, but status verification failed: ${verified.detail}`
      : verifiedStatus !== status
        ? `Klaviyo reported ${verifiedStatus} after ${status} was requested.`
        : null
    if (
      status === "live"
      && verified.ok
      && verifiedStatus !== "live"
      && previousDisabled
      && flow.klaviyoReplacedFlowId
      && previousStatus
    ) {
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
      previousDisabled = false
    }
    await updateEmailStudioFlowKlaviyoSync(client, {
      id: flow.id,
      flowId: flow.klaviyoFlowId,
      status: verifiedStatus,
      syncedRevision: flow.klaviyoSyncedRevision,
      contentChecksum: flow.klaviyoContentChecksum,
      syncedAt: flow.klaviyoSyncedAt,
      replacedFlowId: previousDisabled ? null : flow.klaviyoReplacedFlowId,
      replacedFlowStatus: previousDisabled ? null : flow.klaviyoReplacedFlowStatus,
      userId: staff.userId,
    })
    return { success: true, status: verifiedStatus, warning }
  } catch (error) {
    console.error("[email_studio] flow status failed", error)
    return { error: "Could not update the flow status" }
  }
}
