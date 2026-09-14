import type { SupabaseClient } from '@supabase/supabase-js'
import {
  insertReswellTicketComment,
  updateReswellTicketRow,
  type UpdateReswellTicketRowInput,
} from '@/lib/db/reswellTickets'
import {
  createCursorCloudAgent,
  createCursorCloudAgentFollowUp,
  CursorCloudAgentError,
  getCursorCloudAgent,
  type CursorAgentSnapshot,
} from '@/lib/services/cursorCloudAgent'
import { getReswellTicketService } from '@/lib/services/reswellTickets'
import type { ReswellTicket } from '@/lib/types/reswellTickets'
import {
  buildReswellTicketCursorPrompt,
  collectReswellTicketCursorImageUrls,
} from '@/lib/utils/reswellTicketCursorPrompt'
import { isReswellTicketCursorBusy } from '@/lib/utils/reswellTicketCursorState'

function cursorPatch(snapshot: CursorAgentSnapshot): UpdateReswellTicketRowInput {
  return {
    cursor_agent_id: snapshot.agentId,
    cursor_agent_url: snapshot.agentUrl,
    cursor_agent_status: snapshot.agentStatus,
    cursor_run_id: snapshot.runId,
    cursor_run_status: snapshot.runStatus,
    cursor_pr_url: snapshot.prUrl,
    cursor_last_synced_at: new Date().toISOString(),
  }
}

async function persistSnapshot(
  supabase: SupabaseClient,
  ticket: ReswellTicket,
  authorId: string,
  snapshot: CursorAgentSnapshot,
  comment: string | null,
  extra: UpdateReswellTicketRowInput = {},
): Promise<ReswellTicket> {
  const previousPr = ticket.cursorAgent?.prUrl ?? null
  const previousRun = ticket.cursorAgent?.runStatus ?? null
  const patch: UpdateReswellTicketRowInput = {
    ...cursorPatch(snapshot),
    ...extra,
  }

  await updateReswellTicketRow(supabase, ticket.id, patch)

  const notes: string[] = []
  if (comment) notes.push(comment)
  if (snapshot.prUrl && snapshot.prUrl !== previousPr) {
    notes.push(`Cursor opened a pull request.\n${snapshot.prUrl}`)
  }
  if (snapshot.runStatus === 'ERROR' && previousRun !== 'ERROR') {
    notes.push('Cursor agent run failed. Open the agent or send a follow-up.')
  }

  for (const body of notes) {
    await insertReswellTicketComment(supabase, {
      ticketId: ticket.id,
      authorId,
      body,
    })
  }

  const next = await getReswellTicketService(supabase, ticket.id)
  if (!next) throw new Error('Ticket not found')
  return next
}

export async function dispatchReswellTicketCursorService(
  supabase: SupabaseClient,
  ticketId: string,
  authorId: string,
  force = false,
): Promise<ReswellTicket> {
  const ticket = await getReswellTicketService(supabase, ticketId)
  if (!ticket) throw new Error('Ticket not found')

  const title = ticket.title.trim()
  if (title.length < 2) {
    throw new CursorCloudAgentError('Add a ticket title before sending it to Cursor.', 400)
  }

  if (ticket.cursorAgent && isReswellTicketCursorBusy(ticket.cursorAgent) && !force) {
    throw new CursorCloudAgentError(
      'A Cursor agent is already working this ticket. Send a follow-up, or start a new agent.',
      409,
    )
  }

  if (
    ticket.cursorAgent &&
    ticket.cursorAgent.agentStatus === 'IDLE' &&
    !force
  ) {
    throw new CursorCloudAgentError(
      'This ticket already has a Cursor agent. Send a follow-up, or start a new agent.',
      409,
    )
  }

  const snapshot = await createCursorCloudAgent({
    name: title,
    promptText: buildReswellTicketCursorPrompt(ticket),
    imageUrls: collectReswellTicketCursorImageUrls(ticket),
  })

  return persistSnapshot(
    supabase,
    ticket,
    authorId,
    snapshot,
    `Sent to Cursor Cloud Agent.\n${snapshot.agentUrl}`,
    { status: 'in_progress' },
  )
}

export async function syncReswellTicketCursorService(
  supabase: SupabaseClient,
  ticketId: string,
  authorId: string,
): Promise<ReswellTicket> {
  const ticket = await getReswellTicketService(supabase, ticketId)
  if (!ticket) throw new Error('Ticket not found')
  if (!ticket.cursorAgent) return ticket

  const snapshot = await getCursorCloudAgent(ticket.cursorAgent.agentId)
  return persistSnapshot(supabase, ticket, authorId, snapshot, null)
}

export async function followUpReswellTicketCursorService(
  supabase: SupabaseClient,
  ticketId: string,
  authorId: string,
  text: string,
): Promise<ReswellTicket> {
  const ticket = await getReswellTicketService(supabase, ticketId)
  if (!ticket) throw new Error('Ticket not found')
  if (!ticket.cursorAgent) {
    throw new CursorCloudAgentError('Send this ticket to Cursor before adding a follow-up.', 400)
  }
  if (ticket.cursorAgent.agentStatus === 'ARCHIVED') {
    throw new CursorCloudAgentError(
      'That Cursor agent is archived. Start a new agent from this ticket.',
      409,
    )
  }

  const snapshot = await createCursorCloudAgentFollowUp(
    ticket.cursorAgent.agentId,
    text,
    collectReswellTicketCursorImageUrls(ticket),
  )

  return persistSnapshot(
    supabase,
    ticket,
    authorId,
    snapshot,
    `Sent a follow-up to Cursor.\n${text}`,
    { status: ticket.status === 'done' ? 'in_progress' : ticket.status },
  )
}

