import type { SupabaseClient } from "@supabase/supabase-js"

export type SupportMacroRecord = {
  id: string
  title: string
  body: string
  kind_filter: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const MACRO_SELECT =
  "id, title, body, kind_filter, is_active, sort_order, created_at, updated_at"

function asRecords(data: unknown): SupportMacroRecord[] {
  if (!Array.isArray(data)) return []
  return data as SupportMacroRecord[]
}

export async function listSupportMacrosAdmin(
  supabase: SupabaseClient,
): Promise<SupportMacroRecord[]> {
  const { data, error } = await supabase
    .from("support_macros")
    .select(MACRO_SELECT)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return asRecords(data)
}

export async function listActiveSupportMacros(
  supabase: SupabaseClient,
): Promise<SupportMacroRecord[]> {
  const { data, error } = await supabase
    .from("support_macros")
    .select(MACRO_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }
  return asRecords(data)
}

export async function insertSupportMacro(
  supabase: SupabaseClient,
  args: {
    title: string
    body: string
    kind_filter: string | null
    is_active: boolean
    sort_order: number
  },
): Promise<SupportMacroRecord> {
  const { data, error } = await supabase
    .from("support_macros")
    .insert({
      title: args.title,
      body: args.body,
      kind_filter: args.kind_filter,
      is_active: args.is_active,
      sort_order: args.sort_order,
    })
    .select(MACRO_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create macro")
  }
  return data as SupportMacroRecord
}

export async function updateSupportMacro(
  supabase: SupabaseClient,
  args: {
    id: string
    title?: string
    body?: string
    kind_filter?: string | null
    is_active?: boolean
    sort_order?: number
  },
): Promise<SupportMacroRecord> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (args.title !== undefined) patch.title = args.title
  if (args.body !== undefined) patch.body = args.body
  if (args.kind_filter !== undefined) patch.kind_filter = args.kind_filter
  if (args.is_active !== undefined) patch.is_active = args.is_active
  if (args.sort_order !== undefined) patch.sort_order = args.sort_order

  const { data, error } = await supabase
    .from("support_macros")
    .update(patch)
    .eq("id", args.id)
    .select(MACRO_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update macro")
  }
  return data as SupportMacroRecord
}

export async function deleteSupportMacro(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("support_macros").delete().eq("id", id)
  if (error) {
    throw new Error(error.message)
  }
}
