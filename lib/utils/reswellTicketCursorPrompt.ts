import type { ReswellTicket } from '@/lib/types/reswellTickets'

const MAX_COMMENTS = 20
const MAX_FILES = 30
const MAX_IMAGES = 5

const CURSOR_SYSTEM_COMMENT = /^(Sent to Cursor Cloud Agent|Sent a follow-up to Cursor|Cursor opened a pull request|Cursor agent run failed)/

export function collectReswellTicketCursorImageUrls(ticket: ReswellTicket): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  const add = (url: string | null | undefined) => {
    const trimmed = url?.trim() ?? ''
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return
    if (seen.has(trimmed)) return
    seen.add(trimmed)
    urls.push(trimmed)
  }

  add(ticket.descriptionImageUrl)
  for (const file of ticket.files) {
    if (file.kind === 'image') add(file.url)
    if (urls.length >= MAX_IMAGES) break
  }

  return urls.slice(0, MAX_IMAGES)
}

export function buildReswellTicketCursorPrompt(ticket: ReswellTicket): string {
  const title = ticket.title.trim()
  const subtasks = ticket.subtasks.filter((item) => item.title.trim().length > 0)
  const comments = ticket.comments
    .filter((item) => item.body.trim().length > 0 && !CURSOR_SYSTEM_COMMENT.test(item.body))
    .slice(-MAX_COMMENTS)
  const files = ticket.files.slice(0, MAX_FILES)

  const lines = [
    'You are fulfilling an internal Reswell ticket in this repository.',
    'Read the existing code and match its patterns. Do not invent a new architecture.',
    'Open a draft pull request when the work is done. Do not merge.',
    'If the ticket is unclear or unsafe, stop and explain instead of guessing.',
    '',
    `Ticket ID: ${ticket.id}`,
    `Title: ${title}`,
    `Status: ${ticket.status}`,
    `Type: ${ticket.taskType ?? 'unspecified'}`,
    `Priority: ${ticket.priority ?? 'unspecified'}`,
    `Effort: ${ticket.effortLevel ?? 'unspecified'}`,
    '',
    'Description:',
    ticket.description.trim() || '(empty)',
  ]

  if (subtasks.length > 0) {
    lines.push('', 'Sub-tasks:')
    for (const item of subtasks) {
      lines.push(`- [${item.completed ? 'x' : ' '}] ${item.title.trim()}`)
    }
  }

  if (comments.length > 0) {
    lines.push('', 'Comments:')
    for (const item of comments) {
      const author = item.author?.name.trim() || 'Teammate'
      lines.push(`- ${author}: ${item.body.trim()}`)
    }
  }

  if (files.length > 0) {
    lines.push('', 'Supporting files:')
    for (const file of files) {
      lines.push(`- ${file.kind} ${file.label.trim() || 'file'}: ${file.url}`)
    }
  }

  lines.push(
    '',
    'When you finish, summarize what you changed and include the PR URL if you opened one.',
  )

  return lines.join('\n')
}
