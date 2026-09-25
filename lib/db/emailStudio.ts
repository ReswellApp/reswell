import type { SupabaseClient } from "@supabase/supabase-js"
import { emailStudioDocumentSchema } from "@/lib/validations/emailStudio"
import type { EmailStudioDocument, EmailStudioKind, EmailStudioRecord } from "@/lib/types/emailStudio"

const SELECT =
  "id, kind, name, subject, preview_text, flow_name, flow_id, trigger_metric, notes, document, klaviyo_template_id, created_at, updated_at"

type Row = {
  id: string
  kind: string
  name: string
  subject: string
  preview_text: string
  flow_name: string
  flow_id: string
  trigger_metric: string
  notes: string
  document: unknown
  klaviyo_template_id: string | null
  created_at: string
  updated_at: string
}

function emptyDocument(): EmailStudioDocument {
  return { blocks: [] }
}

function toRecord(row: Row): EmailStudioRecord {
  const parsed = emailStudioDocumentSchema.safeParse(row.document)
  const kind: EmailStudioKind = row.kind === "template" ? "template" : "project"
  return {
    id: row.id,
    kind,
    name: row.name,
    subject: row.subject,
    previewText: row.preview_text,
    flowName: row.flow_name,
    flowId: row.flow_id,
    triggerMetric: row.trigger_metric,
    notes: row.notes,
    document: parsed.success ? parsed.data : emptyDocument(),
    klaviyoTemplateId: row.klaviyo_template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listEmailStudioDocuments(
  supabase: SupabaseClient,
  kind: EmailStudioKind,
): Promise<EmailStudioRecord[]> {
  const { data, error } = await supabase
    .from("email_studio_documents")
    .select(SELECT)
    .eq("kind", kind)
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return ((data ?? []) as Row[]).map(toRecord)
}

export async function getEmailStudioDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<EmailStudioRecord | null> {
  const { data, error } = await supabase
    .from("email_studio_documents")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? toRecord(data as Row) : null
}

export async function insertEmailStudioDocument(
  supabase: SupabaseClient,
  args: {
    kind: EmailStudioKind
    name: string
    subject: string
    previewText: string
    flowName: string
    flowId: string
    triggerMetric: string
    notes: string
    document: EmailStudioDocument
    userId: string
  },
): Promise<EmailStudioRecord> {
  const { data, error } = await supabase
    .from("email_studio_documents")
    .insert({
      kind: args.kind,
      name: args.name,
      subject: args.subject,
      preview_text: args.previewText,
      flow_name: args.flowName,
      flow_id: args.flowId,
      trigger_metric: args.triggerMetric,
      notes: args.notes,
      document: args.document,
      created_by: args.userId,
      updated_by: args.userId,
    })
    .select(SELECT)
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not create email")
  return toRecord(data as Row)
}

export async function updateEmailStudioDocument(
  supabase: SupabaseClient,
  args: {
    id: string
    name: string
    subject: string
    previewText: string
    flowName: string
    flowId: string
    triggerMetric: string
    notes: string
    document: EmailStudioDocument
    userId: string
    klaviyoTemplateId?: string | null
  },
): Promise<EmailStudioRecord> {
  const patch: Record<string, unknown> = {
    name: args.name,
    subject: args.subject,
    preview_text: args.previewText,
    flow_name: args.flowName,
    flow_id: args.flowId,
    trigger_metric: args.triggerMetric,
    notes: args.notes,
    document: args.document,
    updated_by: args.userId,
    updated_at: new Date().toISOString(),
  }
  if (args.klaviyoTemplateId !== undefined) {
    patch.klaviyo_template_id = args.klaviyoTemplateId
  }

  const { data, error } = await supabase
    .from("email_studio_documents")
    .update(patch)
    .eq("id", args.id)
    .select(SELECT)
    .single()

  if (error || !data) throw new Error(error?.message ?? "Could not save email")
  return toRecord(data as Row)
}

export type EmailLibraryImageRow = {
  id: string
  label: string
  src: string
  group: "Blog" | "Listing"
}

export async function listEmailLibraryImageRows(
  supabase: SupabaseClient,
): Promise<EmailLibraryImageRow[]> {
  const [blog, listings] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, title, cover_image_url")
      .not("cover_image_url", "is", null)
      .order("updated_at", { ascending: false })
      .limit(40),
    supabase
      .from("listings")
      .select("id, title, primary_image_url")
      .not("primary_image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(40),
  ])

  if (blog.error) throw new Error(blog.error.message)
  if (listings.error) throw new Error(listings.error.message)

  const blogRows = (blog.data ?? []) as { id: string; title: string | null; cover_image_url: string | null }[]
  const listingRows = (listings.data ?? []) as { id: string; title: string | null; primary_image_url: string | null }[]

  return [
    ...blogRows.flatMap((row) => {
      const src = row.cover_image_url?.trim()
      if (!src) return []
      return [{ id: `blog:${row.id}`, label: row.title?.trim() || "Blog image", src, group: "Blog" as const }]
    }),
    ...listingRows.flatMap((row) => {
      const src = row.primary_image_url?.trim()
      if (!src) return []
      return [{ id: `listing:${row.id}`, label: row.title?.trim() || "Listing photo", src, group: "Listing" as const }]
    }),
  ]
}

export async function deleteEmailStudioDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("email_studio_documents").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
