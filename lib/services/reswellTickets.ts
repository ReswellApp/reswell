import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  deleteReswellTicketComment,
  deleteReswellTicketFile,
  deleteReswellTicketRow,
  deleteReswellTicketSubtask,
  getReswellTicketRow,
  insertReswellTicketComment,
  insertReswellTicketFile,
  insertReswellTicketRow,
  insertReswellTicketSubtask,
  listReswellTicketAssignees,
  listReswellTicketComments,
  listReswellTicketFiles,
  listReswellTicketRows,
  listReswellTicketStaff,
  listReswellTicketSubtasks,
  replaceReswellTicketAssignees,
  updateReswellTicketRow,
  updateReswellTicketSubtaskRow,
  type ReswellTicketCommentRow,
  type ReswellTicketFileRow,
  type ReswellTicketRow,
  type ReswellTicketStaffRow,
  type ReswellTicketSubtaskRow,
} from '@/lib/db/reswellTickets'
import type {
  ReswellTicket,
  ReswellTicketComment,
  ReswellTicketFile,
  ReswellTicketFileKind,
  ReswellTicketStaff,
  ReswellTicketSubtask,
  ReswellTicketsSnapshot,
} from '@/lib/types/reswellTickets'
import type { UpdateReswellTicketInput } from '@/lib/validations/reswellTickets'

function staffClient(userClient: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return userClient
  }
}

function toStaff(row: ReswellTicketStaffRow): ReswellTicketStaff {
  const name = row.display_name?.trim() || row.email?.trim() || 'Teammate'
  return {
    id: row.id,
    name,
    email: row.email,
    avatarUrl: row.avatar_url,
  }
}

function toComment(
  row: ReswellTicketCommentRow,
  staffById: Map<string, ReswellTicketStaff>,
): ReswellTicketComment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    author: row.author_id ? staffById.get(row.author_id) ?? null : null,
    body: row.body,
    createdAt: row.created_at,
  }
}

function toSubtask(row: ReswellTicketSubtaskRow): ReswellTicketSubtask {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    title: row.title,
    completed: row.completed,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

function toFile(row: ReswellTicketFileRow): ReswellTicketFile {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    kind: row.kind,
    label: row.label,
    url: row.url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function toTicket(
  row: ReswellTicketRow,
  staffById: Map<string, ReswellTicketStaff>,
  assigneeIds: string[],
  comments: ReswellTicketCommentRow[],
  subtasks: ReswellTicketSubtaskRow[],
  files: ReswellTicketFileRow[],
): ReswellTicket {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    priority: row.priority,
    taskType: row.task_type,
    effortLevel: row.effort_level,
    description: row.description,
    descriptionImageUrl: row.description_image_url,
    assignees: assigneeIds
      .map((id) => staffById.get(id))
      .filter((person): person is ReswellTicketStaff => Boolean(person)),
    comments: comments.map((comment) => toComment(comment, staffById)),
    subtasks: subtasks.map(toSubtask),
    files: files.map(toFile),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function hydrateTickets(
  supabase: SupabaseClient,
  rows: ReswellTicketRow[],
): Promise<{ tickets: ReswellTicket[]; staff: ReswellTicketStaff[] }> {
  const staff = (await listReswellTicketStaff(staffClient(supabase))).map(toStaff)
  const staffById = new Map(staff.map((person) => [person.id, person]))
  const ticketIds = rows.map((row) => row.id)

  const [assignees, comments, subtasks, files] = await Promise.all([
    listReswellTicketAssignees(supabase, ticketIds),
    listReswellTicketComments(supabase, ticketIds),
    listReswellTicketSubtasks(supabase, ticketIds),
    listReswellTicketFiles(supabase, ticketIds),
  ])

  const assigneesByTicket = new Map<string, string[]>()
  for (const row of assignees) {
    const list = assigneesByTicket.get(row.ticket_id) ?? []
    list.push(row.user_id)
    assigneesByTicket.set(row.ticket_id, list)
  }

  const commentsByTicket = new Map<string, ReswellTicketCommentRow[]>()
  for (const row of comments) {
    const list = commentsByTicket.get(row.ticket_id) ?? []
    list.push(row)
    commentsByTicket.set(row.ticket_id, list)
  }

  const subtasksByTicket = new Map<string, ReswellTicketSubtaskRow[]>()
  for (const row of subtasks) {
    const list = subtasksByTicket.get(row.ticket_id) ?? []
    list.push(row)
    subtasksByTicket.set(row.ticket_id, list)
  }

  const filesByTicket = new Map<string, ReswellTicketFileRow[]>()
  for (const row of files) {
    const list = filesByTicket.get(row.ticket_id) ?? []
    list.push(row)
    filesByTicket.set(row.ticket_id, list)
  }

  return {
    staff,
    tickets: rows.map((row) =>
      toTicket(
        row,
        staffById,
        assigneesByTicket.get(row.id) ?? [],
        commentsByTicket.get(row.id) ?? [],
        subtasksByTicket.get(row.id) ?? [],
        filesByTicket.get(row.id) ?? [],
      ),
    ),
  }
}

async function hydrateOne(
  supabase: SupabaseClient,
  row: ReswellTicketRow,
): Promise<ReswellTicket> {
  const { tickets } = await hydrateTickets(supabase, [row])
  const ticket = tickets[0]
  if (!ticket) throw new Error('Ticket not found')
  return ticket
}

export async function getReswellTicketsSnapshot(
  supabase: SupabaseClient,
  currentUserId: string,
): Promise<ReswellTicketsSnapshot> {
  const rows = await listReswellTicketRows(supabase)
  const { tickets, staff } = await hydrateTickets(supabase, rows)
  return { tickets, staff, currentUserId }
}

export async function createReswellTicketService(
  supabase: SupabaseClient,
  createdBy: string,
): Promise<ReswellTicket> {
  const row = await insertReswellTicketRow(supabase, { createdBy })
  await Promise.all(
    [0, 1, 2].map((sortOrder) =>
      insertReswellTicketSubtask(supabase, {
        ticketId: row.id,
        title: '',
        sortOrder,
      }),
    ),
  )
  return hydrateOne(supabase, row)
}

export async function updateReswellTicketService(
  supabase: SupabaseClient,
  id: string,
  input: UpdateReswellTicketInput,
): Promise<ReswellTicket> {
  const existing = await getReswellTicketRow(supabase, id)
  if (!existing) throw new Error('Ticket not found')

  const patch: Parameters<typeof updateReswellTicketRow>[2] = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.status !== undefined) patch.status = input.status
  if (input.dueDate !== undefined) patch.due_date = input.dueDate
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.taskType !== undefined) patch.task_type = input.taskType
  if (input.effortLevel !== undefined) patch.effort_level = input.effortLevel
  if (input.description !== undefined) patch.description = input.description
  if (input.descriptionImageUrl !== undefined) {
    patch.description_image_url = input.descriptionImageUrl
  }

  const nextRow =
    Object.keys(patch).length > 0
      ? await updateReswellTicketRow(supabase, id, patch)
      : existing

  if (input.assigneeIds) {
    await replaceReswellTicketAssignees(supabase, id, input.assigneeIds)
  }

  return hydrateOne(supabase, nextRow)
}

export async function deleteReswellTicketService(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const existing = await getReswellTicketRow(supabase, id)
  if (!existing) throw new Error('Ticket not found')
  await deleteReswellTicketRow(supabase, id)
}

export async function addReswellTicketCommentService(
  supabase: SupabaseClient,
  ticketId: string,
  authorId: string,
  body: string,
): Promise<ReswellTicketComment> {
  const existing = await getReswellTicketRow(supabase, ticketId)
  if (!existing) throw new Error('Ticket not found')
  const row = await insertReswellTicketComment(supabase, { ticketId, authorId, body })
  const staff = (await listReswellTicketStaff(staffClient(supabase))).map(toStaff)
  const staffById = new Map(staff.map((person) => [person.id, person]))
  return toComment(row, staffById)
}

export async function deleteReswellTicketCommentService(
  supabase: SupabaseClient,
  commentId: string,
): Promise<void> {
  await deleteReswellTicketComment(supabase, commentId)
}

export async function addReswellTicketSubtaskService(
  supabase: SupabaseClient,
  ticketId: string,
  title: string,
): Promise<ReswellTicketSubtask> {
  const existing = await getReswellTicketRow(supabase, ticketId)
  if (!existing) throw new Error('Ticket not found')
  const current = await listReswellTicketSubtasks(supabase, [ticketId])
  const sortOrder = current.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
  const row = await insertReswellTicketSubtask(supabase, {
    ticketId,
    title,
    sortOrder,
  })
  return toSubtask(row)
}

export async function updateReswellTicketSubtaskService(
  supabase: SupabaseClient,
  input: { id: string; title?: string; completed?: boolean },
): Promise<ReswellTicketSubtask> {
  const row = await updateReswellTicketSubtaskRow(supabase, input.id, {
    title: input.title,
    completed: input.completed,
  })
  return toSubtask(row)
}

export async function deleteReswellTicketSubtaskService(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await deleteReswellTicketSubtask(supabase, id)
}

export async function addReswellTicketFileService(
  supabase: SupabaseClient,
  input: {
    ticketId: string
    kind: ReswellTicketFileKind
    url: string
    label?: string
    createdBy: string
  },
): Promise<ReswellTicketFile> {
  const existing = await getReswellTicketRow(supabase, input.ticketId)
  if (!existing) throw new Error('Ticket not found')
  const row = await insertReswellTicketFile(supabase, {
    ticketId: input.ticketId,
    kind: input.kind,
    url: input.url,
    label: input.label?.trim() || defaultFileLabel(input.kind),
    createdBy: input.createdBy,
  })
  return toFile(row)
}

export async function deleteReswellTicketFileService(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await deleteReswellTicketFile(supabase, id)
}

function defaultFileLabel(kind: ReswellTicketFileKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF'
    case 'drive':
      return 'Google Drive'
    case 'figma':
      return 'Figma'
    case 'image':
      return 'Image'
    default:
      return 'Link'
  }
}
