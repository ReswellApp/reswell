import type {
  ReswellTicket,
  ReswellTicketEffort,
  ReswellTicketFileKind,
  ReswellTicketPriority,
  ReswellTicketStaff,
  ReswellTicketStatus,
  ReswellTicketType,
  ReswellTicketView,
} from '@/lib/types/reswellTickets'

export const TICKET_STATUS_META: Record<
  ReswellTicketStatus,
  { label: string; pill: string; dot: string }
> = {
  not_started: {
    label: 'Not started',
    pill: 'bg-[#e3e2e0] text-[#787774]',
    dot: 'bg-[#9a9a97]',
  },
  in_progress: {
    label: 'In progress',
    pill: 'bg-[#d3e5ef] text-[#2383e2]',
    dot: 'bg-[#2383e2]',
  },
  done: {
    label: 'Done',
    pill: 'bg-[#dbeddb] text-[#0f7b6c]',
    dot: 'bg-[#0f7b6c]',
  },
}

export const TICKET_PRIORITY_META: Record<ReswellTicketPriority, { label: string }> = {
  low: { label: 'Low' },
  medium: { label: 'Medium' },
  high: { label: 'High' },
  urgent: { label: 'Urgent' },
}

export const TICKET_TYPE_META: Record<ReswellTicketType, { label: string }> = {
  feature: { label: 'Feature' },
  bug: { label: 'Bug' },
  ops: { label: 'Ops' },
  content: { label: 'Content' },
  design: { label: 'Design' },
  other: { label: 'Other' },
}

export const TICKET_EFFORT_META: Record<ReswellTicketEffort, { label: string }> = {
  xs: { label: 'XS' },
  s: { label: 'S' },
  m: { label: 'M' },
  l: { label: 'L' },
  xl: { label: 'XL' },
}

export const TICKET_VIEW_META: Record<
  ReswellTicketView,
  { label: string; icon: 'star' | 'clock' | 'person' }
> = {
  all: { label: 'All Tasks', icon: 'star' },
  by_status: { label: 'By Status', icon: 'clock' },
  mine: { label: 'My Tasks', icon: 'person' },
  open: { label: 'Open', icon: 'star' },
  done: { label: 'Done', icon: 'star' },
}

export const FILE_KIND_META: Record<ReswellTicketFileKind, { label: string; hint: string }> = {
  pdf: { label: 'Embed a PDF', hint: 'Paste a PDF URL' },
  drive: { label: 'Connect Google Drive', hint: 'Paste a Google Drive link' },
  figma: { label: 'Embed Figma', hint: 'Paste a Figma URL' },
  image: { label: 'Embed an image', hint: 'Paste an image URL' },
  link: { label: 'Add a link', hint: 'Paste any URL' },
}

const AVATAR_TONES = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-indigo-500',
] as const

export function staffAvatarTone(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length
  }
  return AVATAR_TONES[hash] ?? AVATAR_TONES[0]
}

export function staffInitials(person: ReswellTicketStaff): string {
  const parts = person.name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

export function formatTicketDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return ''
  return `${month}/${day}/${year}`
}

export function parseTicketDateInput(value: string): string | null {
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!us) return null
  const month = us[1].padStart(2, '0')
  const day = us[2].padStart(2, '0')
  return `${us[3]}-${month}-${day}`
}

export function ticketDisplayTitle(ticket: ReswellTicket): string {
  const title = ticket.title.trim()
  return title.length > 0 ? title : 'Untitled'
}

export function isOpenStatus(status: ReswellTicketStatus): boolean {
  return status !== 'done'
}
