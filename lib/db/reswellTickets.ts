import type { SupabaseClient } from '@supabase/supabase-js'
import { RESWELL_TICKET_LIST_SELECT } from '@/lib/types/reswellTickets'
import type {
  ReswellTicketEffort,
  ReswellTicketFileKind,
  ReswellTicketPriority,
  ReswellTicketStatus,
  ReswellTicketType,
} from '@/lib/types/reswellTickets'

export interface ReswellTicketRow {
  id: string
  title: string
  status: ReswellTicketStatus
  due_date: string | null
  priority: ReswellTicketPriority | null
  task_type: ReswellTicketType | null
  effort_level: ReswellTicketEffort | null
  description: string
  description_image_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ReswellTicketAssigneeRow {
  ticket_id: string
  user_id: string
}

export interface ReswellTicketCommentRow {
  id: string
  ticket_id: string
  author_id: string | null
  body: string
  created_at: string
}

export interface ReswellTicketSubtaskRow {
  id: string
  ticket_id: string
  title: string
  completed: boolean
  sort_order: number
  created_at: string
}

export interface ReswellTicketFileRow {
  id: string
  ticket_id: string
  kind: ReswellTicketFileKind
  label: string
  url: string
  created_by: string | null
  created_at: string
}

export interface ReswellTicketStaffRow {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

export interface InsertReswellTicketInput {
  title?: string
  createdBy: string
}

export interface UpdateReswellTicketRowInput {
  title?: string
  status?: ReswellTicketStatus
  due_date?: string | null
  priority?: ReswellTicketPriority | null
  task_type?: ReswellTicketType | null
  effort_level?: ReswellTicketEffort | null
  description?: string
  description_image_url?: string | null
}

function throwDb(context: string, message: string): never {
  console.error(`[reswell-tickets] ${context}:`, message)
  throw new Error(message)
}

export async function listReswellTicketRows(
  supabase: SupabaseClient,
): Promise<ReswellTicketRow[]> {
  const { data, error } = await supabase
    .from('reswell_tickets')
    .select(RESWELL_TICKET_LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) throwDb('listReswellTicketRows', error.message)
  return (data ?? []) as ReswellTicketRow[]
}

export async function getReswellTicketRow(
  supabase: SupabaseClient,
  id: string,
): Promise<ReswellTicketRow | null> {
  const { data, error } = await supabase
    .from('reswell_tickets')
    .select(RESWELL_TICKET_LIST_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throwDb('getReswellTicketRow', error.message)
  return (data as ReswellTicketRow | null) ?? null
}

export async function insertReswellTicketRow(
  supabase: SupabaseClient,
  input: InsertReswellTicketInput,
): Promise<ReswellTicketRow> {
  const { data, error } = await supabase
    .from('reswell_tickets')
    .insert({
      title: input.title ?? '',
      created_by: input.createdBy,
    })
    .select(RESWELL_TICKET_LIST_SELECT)
    .single()

  if (error) throwDb('insertReswellTicketRow', error.message)
  return data as ReswellTicketRow
}

export async function updateReswellTicketRow(
  supabase: SupabaseClient,
  id: string,
  input: UpdateReswellTicketRowInput,
): Promise<ReswellTicketRow> {
  const { data, error } = await supabase
    .from('reswell_tickets')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(RESWELL_TICKET_LIST_SELECT)
    .single()

  if (error) throwDb('updateReswellTicketRow', error.message)
  return data as ReswellTicketRow
}

export async function deleteReswellTicketRow(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('reswell_tickets').delete().eq('id', id)
  if (error) throwDb('deleteReswellTicketRow', error.message)
}

export async function listReswellTicketAssignees(
  supabase: SupabaseClient,
  ticketIds: string[],
): Promise<ReswellTicketAssigneeRow[]> {
  if (ticketIds.length === 0) return []
  const { data, error } = await supabase
    .from('reswell_ticket_assignees')
    .select('ticket_id, user_id')
    .in('ticket_id', ticketIds)

  if (error) throwDb('listReswellTicketAssignees', error.message)
  return (data ?? []) as ReswellTicketAssigneeRow[]
}

export async function replaceReswellTicketAssignees(
  supabase: SupabaseClient,
  ticketId: string,
  userIds: string[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('reswell_ticket_assignees')
    .delete()
    .eq('ticket_id', ticketId)
  if (deleteError) throwDb('replaceReswellTicketAssignees.delete', deleteError.message)

  const uniqueIds = Array.from(new Set(userIds))
  if (uniqueIds.length === 0) return

  const { error: insertError } = await supabase.from('reswell_ticket_assignees').insert(
    uniqueIds.map((userId) => ({
      ticket_id: ticketId,
      user_id: userId,
    })),
  )
  if (insertError) throwDb('replaceReswellTicketAssignees.insert', insertError.message)
}

export async function listReswellTicketComments(
  supabase: SupabaseClient,
  ticketIds: string[],
): Promise<ReswellTicketCommentRow[]> {
  if (ticketIds.length === 0) return []
  const { data, error } = await supabase
    .from('reswell_ticket_comments')
    .select('id, ticket_id, author_id, body, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true })

  if (error) throwDb('listReswellTicketComments', error.message)
  return (data ?? []) as ReswellTicketCommentRow[]
}

export async function insertReswellTicketComment(
  supabase: SupabaseClient,
  input: { ticketId: string; authorId: string; body: string },
): Promise<ReswellTicketCommentRow> {
  const { data, error } = await supabase
    .from('reswell_ticket_comments')
    .insert({
      ticket_id: input.ticketId,
      author_id: input.authorId,
      body: input.body,
    })
    .select('id, ticket_id, author_id, body, created_at')
    .single()

  if (error) throwDb('insertReswellTicketComment', error.message)
  return data as ReswellTicketCommentRow
}

export async function deleteReswellTicketComment(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('reswell_ticket_comments').delete().eq('id', id)
  if (error) throwDb('deleteReswellTicketComment', error.message)
}

export async function listReswellTicketSubtasks(
  supabase: SupabaseClient,
  ticketIds: string[],
): Promise<ReswellTicketSubtaskRow[]> {
  if (ticketIds.length === 0) return []
  const { data, error } = await supabase
    .from('reswell_ticket_subtasks')
    .select('id, ticket_id, title, completed, sort_order, created_at')
    .in('ticket_id', ticketIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throwDb('listReswellTicketSubtasks', error.message)
  return (data ?? []) as ReswellTicketSubtaskRow[]
}

export async function insertReswellTicketSubtask(
  supabase: SupabaseClient,
  input: { ticketId: string; title: string; sortOrder: number },
): Promise<ReswellTicketSubtaskRow> {
  const { data, error } = await supabase
    .from('reswell_ticket_subtasks')
    .insert({
      ticket_id: input.ticketId,
      title: input.title,
      sort_order: input.sortOrder,
    })
    .select('id, ticket_id, title, completed, sort_order, created_at')
    .single()

  if (error) throwDb('insertReswellTicketSubtask', error.message)
  return data as ReswellTicketSubtaskRow
}

export async function updateReswellTicketSubtaskRow(
  supabase: SupabaseClient,
  id: string,
  input: { title?: string; completed?: boolean },
): Promise<ReswellTicketSubtaskRow> {
  const { data, error } = await supabase
    .from('reswell_ticket_subtasks')
    .update(input)
    .eq('id', id)
    .select('id, ticket_id, title, completed, sort_order, created_at')
    .single()

  if (error) throwDb('updateReswellTicketSubtaskRow', error.message)
  return data as ReswellTicketSubtaskRow
}

export async function deleteReswellTicketSubtask(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('reswell_ticket_subtasks').delete().eq('id', id)
  if (error) throwDb('deleteReswellTicketSubtask', error.message)
}

export async function listReswellTicketFiles(
  supabase: SupabaseClient,
  ticketIds: string[],
): Promise<ReswellTicketFileRow[]> {
  if (ticketIds.length === 0) return []
  const { data, error } = await supabase
    .from('reswell_ticket_files')
    .select('id, ticket_id, kind, label, url, created_by, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true })

  if (error) throwDb('listReswellTicketFiles', error.message)
  return (data ?? []) as ReswellTicketFileRow[]
}

export async function insertReswellTicketFile(
  supabase: SupabaseClient,
  input: {
    ticketId: string
    kind: ReswellTicketFileKind
    label: string
    url: string
    createdBy: string
  },
): Promise<ReswellTicketFileRow> {
  const { data, error } = await supabase
    .from('reswell_ticket_files')
    .insert({
      ticket_id: input.ticketId,
      kind: input.kind,
      label: input.label,
      url: input.url,
      created_by: input.createdBy,
    })
    .select('id, ticket_id, kind, label, url, created_by, created_at')
    .single()

  if (error) throwDb('insertReswellTicketFile', error.message)
  return data as ReswellTicketFileRow
}

export async function deleteReswellTicketFile(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('reswell_ticket_files').delete().eq('id', id)
  if (error) throwDb('deleteReswellTicketFile', error.message)
}

export async function listReswellTicketStaff(
  supabase: SupabaseClient,
): Promise<ReswellTicketStaffRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url')
    .or('is_admin.eq.true,is_employee.eq.true')
    .order('display_name', { ascending: true })

  if (error) throwDb('listReswellTicketStaff', error.message)
  return (data ?? []) as ReswellTicketStaffRow[]
}
