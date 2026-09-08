import { getCareerRoleBySlug } from "@/lib/careers"
import {
  attachCareerApplicationResume,
  createCareerResumeSignedUrl,
  getCareerApplicationById,
  insertCareerApplication,
  listCareerApplications,
  updateCareerApplicationStatus,
} from "@/lib/db/careerApplications"
import type {
  CareerApplication,
  CareerApplicationAdminDetail,
  CareerApplicationStatus,
} from "@/lib/types/career-application"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import { trackKlaviyoCareerApplicationSubmitted } from "@/lib/klaviyo/track-career-application"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import {
  CAREER_RESUME_BUCKET,
  CAREER_RESUME_MAX_BYTES,
  CAREER_RESUME_MIME_TYPES,
  type CareerApplicationSubmitInput,
} from "@/lib/validations/careerApplication"

type ActionOk<T> = { success: true; data: T }
type ActionErr = { error: string }
type ActionResult<T> = ActionOk<T> | ActionErr

const GENERAL_ROLE_TITLE = "General application"

type Authed =
  | { ok: false; error: string }
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }

async function requireStaff(): Promise<Authed> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user || isAnonymousSupabaseUser(data.user)) {
    return { ok: false, error: "Sign in required" }
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", data.user.id)
    .maybeSingle()
  if (profile?.is_admin !== true && profile?.is_employee !== true) {
    return { ok: false, error: "Forbidden" }
  }
  return { ok: true, supabase }
}

function resumeExtension(mimeType: string, fileName: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase()
  if (fromName === "pdf" || fromName === "doc" || fromName === "docx") return fromName
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType === "application/msword") return "doc"
  return "docx"
}

function safeResumeFileName(fileName: string, mimeType: string): string {
  const base = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 80)
  const ext = resumeExtension(mimeType, fileName)
  if (base.toLowerCase().endsWith(`.${ext}`)) return base || `resume.${ext}`
  return base ? `${base}.${ext}` : `resume.${ext}`
}

function resumeMimeType(file: File): string | null {
  if ((CAREER_RESUME_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type
  }
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "application/pdf"
  if (ext === "doc") return "application/msword"
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return null
}

function validateResume(file: File): ActionErr | { ok: true; mimeType: string } {
  if (file.size <= 0) return { error: "Resume file is empty" }
  if (file.size > CAREER_RESUME_MAX_BYTES) {
    return { error: "Resume must be 4 MB or smaller" }
  }
  const mimeType = resumeMimeType(file)
  if (!mimeType) {
    return { error: "Resume must be a PDF or Word document" }
  }
  return { ok: true, mimeType }
}

export async function submitCareerApplicationService(
  input: CareerApplicationSubmitInput,
  resume: File | null,
): Promise<ActionResult<{ id: string }>> {
  if (input.company && input.company.trim().length > 0) {
    return { success: true, data: { id: "ok" } }
  }

  const slug = input.roleSlug?.trim() || null
  let roleTitle = GENERAL_ROLE_TITLE
  if (slug) {
    const role = getCareerRoleBySlug(slug)
    if (!role) {
      return { error: "That role is no longer open" }
    }
    roleTitle = role.title
  }

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (error) {
    console.error("submitCareerApplicationService: missing service role client", error)
    return { error: "Could not submit your application" }
  }

  const inserted = await insertCareerApplication(supabase, {
    roleSlug: slug,
    roleTitle,
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    surfingNote: input.surfingNote,
    favoriteBoard: input.favoriteBoard,
  })
  if ("error" in inserted) {
    console.error("career application insert:", inserted.error)
    return { error: "Could not submit your application" }
  }

  let hasResume = false
  if (resume) {
    const resumeCheck = validateResume(resume)
    if (!("error" in resumeCheck)) {
      const fileName = safeResumeFileName(resume.name, resumeCheck.mimeType)
      const storagePath = `${inserted.id}/${crypto.randomUUID()}-${fileName}`
      const bytes = new Uint8Array(await resume.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from(CAREER_RESUME_BUCKET)
        .upload(storagePath, bytes, {
          contentType: resumeCheck.mimeType,
          upsert: false,
        })
      if (uploadError) {
        console.error("career resume upload:", uploadError.message)
      } else {
        const attached = await attachCareerApplicationResume(supabase, {
          id: inserted.id,
          storagePath,
          fileName,
          mimeType: resumeCheck.mimeType,
          sizeBytes: resume.size,
        })
        if (attached.error) {
          console.error("career resume attach:", attached.error)
        } else {
          hasResume = true
        }
      }
    }
  }

  void trackKlaviyoCareerApplicationSubmitted({
    applicationId: inserted.id,
    email: input.email,
    name: input.name,
    phone: input.phone,
    roleSlug: slug,
    roleTitle,
    surfingNote: input.surfingNote,
    favoriteBoard: input.favoriteBoard,
    hasResume,
  })

  return { success: true, data: { id: inserted.id } }
}

export async function listAdminCareerApplicationsService(): Promise<
  ActionResult<CareerApplication[]>
> {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  try {
    const rows = await listCareerApplications(auth.supabase)
    return { success: true, data: rows }
  } catch (error) {
    console.error("listAdminCareerApplicationsService:", error)
    return { error: "Could not load applications" }
  }
}

export async function getAdminCareerApplicationService(
  id: string,
): Promise<ActionResult<CareerApplicationAdminDetail>> {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  try {
    const row = await getCareerApplicationById(auth.supabase, id)
    if (!row) return { error: "Not found" }
    let resumeSignedUrl: string | null = null
    if (row.resumeStoragePath && row.resumeFileName) {
      const service = createServiceRoleClient()
      resumeSignedUrl = await createCareerResumeSignedUrl(
        service,
        row.resumeStoragePath,
        row.resumeFileName,
      )
    }
    return { success: true, data: { ...row, resumeSignedUrl } }
  } catch (error) {
    console.error("getAdminCareerApplicationService:", error)
    return { error: "Could not load application" }
  }
}

export async function updateCareerApplicationStatusService(
  id: string,
  status: CareerApplicationStatus,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireStaff()
  if (!auth.ok) return { error: auth.error }
  const updated = await updateCareerApplicationStatus(auth.supabase, id, status)
  if (updated.error) {
    console.error("updateCareerApplicationStatusService:", updated.error)
    return { error: "Could not update status" }
  }
  return { success: true, data: { id } }
}
