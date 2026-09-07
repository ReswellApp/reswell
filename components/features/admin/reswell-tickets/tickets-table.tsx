'use client'

import {
  Calendar,
  CaseSensitive,
  CircleDot,
  Hourglass,
  Package,
  Target,
  Text,
  Users,
} from 'lucide-react'
import type { ReswellTicket, ReswellTicketStaff, ReswellTicketStatus } from '@/lib/types/reswellTickets'
import type { UpdateReswellTicketInput } from '@/lib/validations/reswellTickets'
import { TicketRow } from './ticket-row'
import { TICKET_STATUS_META } from './ticket-ui'

interface TicketsTableProps {
  tickets: ReswellTicket[]
  staff: ReswellTicketStaff[]
  currentUserId: string
  selectedId: string | null
  checkedIds: Set<string>
  groupByStatus?: boolean
  onToggleChecked: (id: string) => void
  onOpen: (id: string) => void
  onClose: () => void
  onUpdate: (id: string, patch: UpdateReswellTicketInput) => void
  onCreate: () => void
}

const HEADERS = [
  { label: 'Task name', icon: CaseSensitive, className: 'min-w-[16rem]' },
  { label: 'Status', icon: CircleDot, className: 'w-[9rem]' },
  { label: 'Assignee', icon: Users, className: 'w-[11rem]' },
  { label: 'Due date', icon: Calendar, className: 'w-[7.5rem]' },
  { label: 'Priority', icon: Target, className: 'w-[7rem]' },
  { label: 'Task type', icon: Package, className: 'w-[7.5rem]' },
  { label: 'Effort level', icon: Hourglass, className: 'w-[7rem]' },
  { label: 'Description', icon: Text, className: 'w-[10rem]' },
] as const

function TableHead() {
  return (
    <thead>
      <tr className="border-b border-[#e9e9e7] text-xs text-neutral-500">
        <th className="w-8 px-1 py-2" />
        {HEADERS.map((header) => (
          <th key={header.label} className={`${header.className} px-1 py-2 text-left font-medium`}>
            <span className="inline-flex items-center gap-1.5">
              <header.icon className="h-3.5 w-3.5" aria-hidden />
              {header.label}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  )
}

function Rows({
  tickets,
  ...rest
}: Omit<TicketsTableProps, 'groupByStatus' | 'onCreate'> & { tickets: ReswellTicket[] }) {
  return (
    <>
      {tickets.map((ticket) => (
        <TicketRow
          key={ticket.id}
          ticket={ticket}
          staff={rest.staff}
          currentUserId={rest.currentUserId}
          selected={rest.selectedId === ticket.id}
          checked={rest.checkedIds.has(ticket.id)}
          onToggleChecked={() => rest.onToggleChecked(ticket.id)}
          onOpen={() => rest.onOpen(ticket.id)}
          onClose={rest.onClose}
          onUpdate={(patch) => rest.onUpdate(ticket.id, patch)}
        />
      ))}
    </>
  )
}

export function TicketsTable({
  tickets,
  groupByStatus = false,
  onCreate,
  ...rest
}: TicketsTableProps) {
  const groups: ReswellTicketStatus[] = ['not_started', 'in_progress', 'done']

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[72rem] border-collapse">
        <TableHead />
        {groupByStatus ? (
          groups.map((status) => {
            const rows = tickets.filter((ticket) => ticket.status === status)
            if (rows.length === 0) return null
            return (
              <tbody key={status}>
                <tr>
                  <td colSpan={9} className="px-1 pb-1 pt-4 text-xs font-semibold text-neutral-500">
                    {TICKET_STATUS_META[status].label}
                    <span className="ml-1 font-normal text-neutral-400">{rows.length}</span>
                  </td>
                </tr>
                <Rows tickets={rows} {...rest} />
              </tbody>
            )
          })
        ) : (
          <tbody>
            <Rows tickets={tickets} {...rest} />
          </tbody>
        )}
      </table>
      <button
        type="button"
        onClick={onCreate}
        className="mt-1 w-full rounded-sm px-8 py-2 text-left text-sm text-neutral-400 hover:bg-[#f7f6f3]"
      >
        New
      </button>
    </div>
  )
}
