import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CareerApplication,
  CareerApplicationStatus,
} from "@/lib/types/career-application"
import { CAREER_RESUME_BUCKET } from "@/lib/validations/careerApplication"

export const CAREER_APPLICATION_SELECT =
  "id, role_slug, role_title, name, email, phone, surfing_note, favorite_board, resume_storage_path, resume_file_name, resume_mime_type, resume_size_bytes, status, created_at, updated_at"

type CareerApplicationRow = {
  id: string
  role_slug: string | null
  role_title: string
  name: string
  email: string
  phone: string | null
  surfing_note: string
  favorite_board: string
  resume_storage_path: string | null
  resume_file_name: string | null
  resume_mime_type: string | null
  resume_size_bytes: number | null
  status: CareerApplicationStatus
  created_at: string
  updated_at: string
}

export function mapCareerApplicationRow(row: CareerApplicationRow): CareerApplication {
  return {
    id: row.id,
    roleSlug: row.role_slug,
    roleTitle: row.role_title,
    name: row.name,
    email: row.email,
    phone: row.phone,
    surfingNote: row.surfing_note,
    favoriteBoard: row.favorite_board,
    resumeStoragePath: row.resume_storage_path,
    resumeFileName: row.resume_file_name,
    resumeMimeType: row.resume_mime_type,
    resumeSizeBytes: row.resume_size_bytes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function insertCareerApplication(
  supabase: SupabaseClient,
  row: {
    roleSlug: string | null
    roleTitle: string
    name: string
    email: string
    phone: string | null
    surfingNote: string
    favoriteBoard: string
  },
): Promise<{ id: string } | { error: Error }> {
  const { data, error } = await supabase
    .from("career_applications")
    .insert({
      role_slug: row.roleSlug,
      role_title: row.roleTitle,
      name: row.name,
      email: row.email,
      phone: row.phone,
      surfing_note: row.surfingNote,
      favorite_board: row.favoriteBoard,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    return { error: new Error(error?.message ?? "Failed to save application") }
  }
  return { id: String(data.id) }
}

export async function attachCareerApplicationResume(
  supabase: SupabaseClient,
  args: {
    id: string
    storagePath: string
    fileName: string
    mimeType: string
    sizeBytes: number
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("career_applications")
    .update({
      resume_storage_path: args.storagePath,
      resume_file_name: args.fileName,
      resume_mime_type: args.mimeType,
      resume_size_bytes: args.sizeBytes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.id)

  return { error: error ? new Error(error.message) : null }
}

export async function listCareerApplications(
  supabase: SupabaseClient,
): Promise<CareerApplication[]> {
  const { data, error } = await supabase
    .from("career_applications")
    .select(CAREER_APPLICATION_SELECT)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapCareerApplicationRow(row as CareerApplicationRow))
}

export async function getCareerApplicationById(
  supabase: SupabaseClient,
  id: string,
): Promise<CareerApplication | null> {
  const { data, error } = await supabase
    .from("career_applications")
    .select(CAREER_APPLICATION_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }
  if (!data) return null
  return mapCareerApplicationRow(data as CareerApplicationRow)
}

export async function updateCareerApplicationStatus(
  supabase: SupabaseClient,
  id: string,
  status: CareerApplicationStatus,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("career_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)

  return { error: error ? new Error(error.message) : null }
}

export async function createCareerResumeSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  fileName: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CAREER_RESUME_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, { download: fileName })

  if (error || !data?.signedUrl) return null
  return data.signedUrl
}
