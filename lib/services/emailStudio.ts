import { createHash } from "node:crypto"
import {
  getKlaviyoApiKey,
  klaviyoGet,
  klaviyoGetAllPages,
  klaviyoWrite,
} from "@/lib/klaviyo/api-client"
import { KLAVIYO_API_REVISION } from "@/lib/klaviyo/send-event"
import {
  cloneEmailDocument,
  starterById,
  blankEmailDocument,
} from "@/lib/email-studio/document"
import { renderEmailStudioText, resolveEmailStudioHtml } from "@/lib/email-studio/render-html"
import {
  deleteEmailStudioDocument,
  getEmailStudioDocument,
  insertEmailStudioDocument,
  listEmailLibraryImageRows,
  listEmailStudioDocuments,
  updateEmailStudioDocument,
  updateEmailStudioKlaviyoSync,
} from "@/lib/db/emailStudio"
import { emailImageSrc } from "@/lib/email-studio/email-image-url"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { EmailStudioDocument, EmailStudioFlowOption, EmailStudioKind, EmailStudioRecord } from "@/lib/types/emailStudio"
import type { CreateEmailStudioInput, UpdateEmailStudioInput } from "@/lib/validations/emailStudio"

type ServiceError = { error: string }
type Authed =
  | { ok: false; error: string }
  | { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> }

async function requireStaff(): Promise<Authed> {
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

function sourceDocument(input: CreateEmailStudioInput, template: EmailStudioRecord | null): {
  document: EmailStudioDocument
  subject: string
  previewText: string
  triggerMetric: string
} | ServiceError {
  if (input.templateId) {
    if (!template) return { error: "Template not found" }
    return {
      document: cloneEmailDocument(template.document),
      subject: template.subject,
      previewText: template.previewText,
      triggerMetric: template.triggerMetric,
    }
  }
  const starter = starterById(input.starterId || "blank") ?? starterById("blank")
  if (!starter) {
    return {
      document: blankEmailDocument(),
      subject: "",
      previewText: "",
      triggerMetric: "",
    }
  }
  return {
    document: cloneEmailDocument(starter.document),
    subject: starter.subject,
    previewText: starter.previewText,
    triggerMetric: starter.triggerMetric,
  }
}

export async function listEmailStudioService(
  kind: EmailStudioKind,
): Promise<{ success: true; data: EmailStudioRecord[] } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await listEmailStudioDocuments(dbClient(staff.supabase), kind)
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] list failed", error)
    return { error: "Could not load email projects" }
  }
}

export async function getEmailStudioService(
  id: string,
): Promise<{ success: true; data: EmailStudioRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await getEmailStudioDocument(dbClient(staff.supabase), id)
    if (!data) return { error: "Project not found" }
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] get failed", error)
    return { error: "Could not load this email" }
  }
}

export async function createEmailStudioService(
  input: CreateEmailStudioInput,
): Promise<{ success: true; data: EmailStudioRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const template = input.templateId
      ? await getEmailStudioDocument(client, input.templateId)
      : null
    const source = sourceDocument(input, template)
    if ("error" in source) return source
    const data = await insertEmailStudioDocument(client, {
      kind: input.kind,
      name: input.name,
      subject: source.subject,
      previewText: source.previewText,
      flowName: "",
      flowId: "",
      triggerMetric: source.triggerMetric,
      notes: "",
      document: source.document,
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] create failed", error)
    return { error: "Could not create this email" }
  }
}

export async function updateEmailStudioService(
  input: UpdateEmailStudioInput,
): Promise<{ success: true; data: EmailStudioRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const data = await updateEmailStudioDocument(dbClient(staff.supabase), {
      id: input.id,
      name: input.name,
      subject: input.subject,
      previewText: input.previewText,
      flowName: input.flowName,
      flowId: input.flowId,
      triggerMetric: input.triggerMetric,
      notes: input.notes,
      document: input.document,
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] update failed", error)
    return { error: "Could not save this email" }
  }
}

export async function deleteEmailStudioService(id: string): Promise<{ success: true } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    await deleteEmailStudioDocument(dbClient(staff.supabase), id)
    return { success: true }
  } catch (error) {
    console.error("[email_studio] delete failed", error)
    return { error: "Could not delete this email" }
  }
}

export async function duplicateEmailStudioService(
  id: string,
): Promise<{ success: true; data: EmailStudioRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const existing = await getEmailStudioDocument(client, id)
    if (!existing) return { error: "Project not found" }
    const data = await insertEmailStudioDocument(client, {
      kind: "project",
      name: `${existing.name} copy`.slice(0, 120),
      subject: existing.subject,
      previewText: existing.previewText,
      flowName: existing.flowName,
      flowId: "",
      triggerMetric: existing.triggerMetric,
      notes: existing.notes,
      document: cloneEmailDocument(existing.document),
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] duplicate failed", error)
    return { error: "Could not duplicate this email" }
  }
}

export async function saveEmailStudioTemplateService(
  id: string,
  name: string,
): Promise<{ success: true; data: EmailStudioRecord } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const existing = await getEmailStudioDocument(client, id)
    if (!existing) return { error: "Project not found" }
    const data = await insertEmailStudioDocument(client, {
      kind: "template",
      name,
      subject: existing.subject,
      previewText: existing.previewText,
      flowName: "",
      flowId: "",
      triggerMetric: existing.triggerMetric,
      notes: "",
      document: cloneEmailDocument(existing.document),
      userId: staff.userId,
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] save template failed", error)
    return { error: "Could not save the template" }
  }
}

type KlaviyoTemplateResponse = {
  data?: {
    id?: string
    attributes?: { name?: string; html?: string; text?: string }
  }
}

export async function pushEmailStudioToKlaviyoService(
  id: string,
): Promise<{
  success: true
  templateId: string
  syncedRevision: number | null
  checksum: string | null
  syncedAt: string | null
  warning: string | null
} | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    const existing = await getEmailStudioDocument(client, id)
    if (!existing) return { error: "Project not found" }
    const renderInput = {
      name: existing.name,
      subject: existing.subject,
      previewText: existing.previewText,
      flowName: existing.flowName,
      triggerMetric: existing.triggerMetric,
      document: existing.document,
    }
    const html = resolveEmailStudioHtml(renderInput)
    const text = renderEmailStudioText(renderInput)
    const attributes = {
      name: `Reswell · ${existing.name}`.slice(0, 255),
      html,
      text,
    }
    const checksum = createHash("sha256")
      .update(JSON.stringify(attributes))
      .digest("hex")
    const created = existing.klaviyoTemplateId
      ? await klaviyoWrite<KlaviyoTemplateResponse>("PATCH", `/api/templates/${existing.klaviyoTemplateId}/`, {
          data: { type: "template", id: existing.klaviyoTemplateId, attributes },
        })
      : await klaviyoWrite<KlaviyoTemplateResponse>("POST", "/api/templates/", {
          data: { type: "template", attributes: { ...attributes, editor_type: "CODE" } },
        })
    const result =
      !created.ok && existing.klaviyoTemplateId && created.status === 404
        ? await klaviyoWrite<KlaviyoTemplateResponse>("POST", "/api/templates/", {
            data: { type: "template", attributes: { ...attributes, editor_type: "CODE" } },
          })
        : created
    if (!result.ok) return { error: result.detail || "Klaviyo rejected the template" }
    const templateId = result.data.data?.id
    if (!templateId) return { error: "Klaviyo saved the template without an id" }
    const verified = await klaviyoGet<KlaviyoTemplateResponse>(
      `/api/templates/${templateId}/`,
      { "fields[template]": "name,html,text" },
    )
    const warning = !verified.ok
      ? `Template saved, but verification failed: ${verified.detail}`
      : verified.data.data?.id !== templateId
        ? "Template saved, but Klaviyo returned a different id during verification."
        : null
    const syncedAt = new Date().toISOString()
    await updateEmailStudioKlaviyoSync(client, {
      id: existing.id,
      templateId,
      syncedRevision: warning ? null : existing.revision,
      contentChecksum: warning ? null : checksum,
      syncedAt: warning ? null : syncedAt,
      userId: staff.userId,
    })
    return {
      success: true,
      templateId,
      syncedRevision: warning ? null : existing.revision,
      checksum: warning ? null : checksum,
      syncedAt: warning ? null : syncedAt,
      warning,
    }
  } catch (error) {
    console.error("[email_studio] klaviyo push failed", error)
    return { error: "Could not push this template to Klaviyo" }
  }
}

export async function sendEmailStudioTestService(
  id: string,
  recipient: string,
): Promise<{ success: true; jobId: string } | ServiceError> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const client = dbClient(staff.supabase)
    let existing = await getEmailStudioDocument(client, id)
    if (!existing) return { error: "Project not found" }
    if (
      !existing.klaviyoTemplateId
      || existing.klaviyoSyncedRevision !== existing.revision
    ) {
      const pushed = await pushEmailStudioToKlaviyoService(id)
      if ("error" in pushed) return pushed
      existing = await getEmailStudioDocument(client, id)
      if (!existing) return { error: "Project not found after Klaviyo sync" }
    }
    const templateId = existing.klaviyoTemplateId
    if (!templateId) return { error: "Push the template to Klaviyo before sending a test." }
    const sent = await klaviyoWrite<{ data?: { id?: string } }>(
      "POST",
      "/api/template-preview-send-jobs",
      {
        data: {
          type: "template-preview-send-job",
          attributes: {
            recipients: [recipient],
            context: {
              first_name: "Alex",
              event: {
                order_num: "RW-1042",
                Title: "6'2 Reswell Test Board",
                "$value": "$640",
                order_url: "https://www.reswell.app",
                listing_url: "https://www.reswell.app",
              },
            },
          },
          relationships: {
            template: {
              data: { type: "template", id: templateId },
            },
          },
        },
      },
      { revision: `${KLAVIYO_API_REVISION}.pre`, maxAttempts: 2 },
    )
    if (!sent.ok) return { error: sent.detail || "Klaviyo rejected the test send" }
    const jobId = sent.data.data?.id
    if (!jobId) return { error: "Klaviyo accepted the test without a job id" }
    return { success: true, jobId }
  } catch (error) {
    console.error("[email_studio] test send failed", error)
    return { error: "Could not send this test email" }
  }
}

export async function listEmailStudioFlowsService(): Promise<{
  connected: boolean
  flows: EmailStudioFlowOption[]
}> {
  const staff = await requireStaff()
  if (!staff.ok || !getKlaviyoApiKey()) return { connected: false, flows: [] }
  const result = await klaviyoGetAllPages<{
    id: string
    attributes?: { name?: string; status?: string; archived?: boolean }
  }>("/api/flows/", { "fields[flow]": "name,status,archived", "page[size]": "50" }, { maxPages: 20 })
  if (!result.ok) return { connected: false, flows: [] }
  const flows = result.data
    .filter((flow) => flow.attributes?.archived !== true)
    .map((flow) => ({
      id: flow.id,
      name: flow.attributes?.name?.trim() || "Untitled flow",
      status: flow.attributes?.status?.trim() || "unknown",
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { connected: true, flows }
}

export async function listEmailLibraryImagesService(): Promise<
  { success: true; data: { id: string; label: string; src: string; group: "Blog" | "Listing" }[] } | ServiceError
> {
  const staff = await requireStaff()
  if (!staff.ok) return { error: staff.error }
  try {
    const rows = await listEmailLibraryImageRows(dbClient(staff.supabase))
    const data = rows.flatMap((row) => {
      const src = emailImageSrc(row.src)
      if (!src.startsWith("https://")) return []
      return [{ ...row, src }]
    })
    return { success: true, data }
  } catch (error) {
    console.error("[email_studio] image library failed", error)
    return { error: "Could not load saved images" }
  }
}
