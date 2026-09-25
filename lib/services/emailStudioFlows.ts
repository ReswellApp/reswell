import "server-only"

import { getKlaviyoApiKey, klaviyoGetAllPages, klaviyoWrite } from "@/lib/klaviyo/api-client"
import { compileKlaviyoFlow } from "@/lib/email-studio/compile-klaviyo-flow"
import { blankFlowDefinition, walkFlowSteps } from "@/lib/email-studio/flow-definition"
import {
  deleteEmailStudioFlow,
  getEmailStudioFlow,
  insertEmailStudioFlow,
  listEmailStudioFlows,
  updateEmailStudioFlow,
} from "@/lib/db/emailStudioFlows"
import { getEmailStudioDocument } from "@/lib/db/emailStudio"
import { pushEmailStudioToKlaviyoService } from "@/lib/services/emailStudio"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { EmailStudioFlowRecord, KlaviyoCatalogOption } from "@/lib/types/emailStudioFlow"
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
): Promise<{ success: true; data: EmailStudioFlowRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await getEmailStudioFlow(dbClient(staff.supabase), id)
    if (!data) return { error: "Flow not found" }
    return { success: true, data }
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
  }, { maxPages: 4 })
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

export async function pushEmailStudioFlowService(
  id: string,
  replace = false,
): Promise<{ success: true; klaviyoFlowId: string; replacedId: string | null } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const flow = await getEmailStudioFlow(client, id)
    if (!flow) return { error: "Flow not found" }
    if (flow.klaviyoFlowId && !replace) {
      return { error: "This flow is already in Klaviyo. Push again only to create a new draft." }
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
      if (!templateId) {
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
    await updateEmailStudioFlow(client, {
      id: flow.id,
      name: flow.name,
      notes: flow.notes,
      definition: flow.definition,
      userId: staff.userId,
      klaviyoFlowId,
      klaviyoStatus: "draft",
    })
    return { success: true, klaviyoFlowId, replacedId: replace ? flow.klaviyoFlowId : null }
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
    if (!updated.ok) return { error: updated.detail || "Klaviyo rejected the status change" }
    await updateEmailStudioFlow(client, {
      id: flow.id,
      name: flow.name,
      notes: flow.notes,
      definition: flow.definition,
      userId: staff.userId,
      klaviyoStatus: status,
    })
    return { success: true }
  } catch (error) {
    console.error("[email_studio] flow status failed", error)
    return { error: "Could not update the flow status" }
  }
}
