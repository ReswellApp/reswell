'use client'

import { PanelRight } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ReswellTicket, ReswellTicketStaff } from '@/lib/types/reswellTickets'
import type { UpdateReswellTicketInput } from '@/lib/validations/reswellTickets'
import { AssigneePicker } from './assignee-picker'
import { TicketDatePicker } from './date-picker'
import { SelectCell } from './select-cell'
import { StatusPill } from './status-pill'
import {
  TICKET_EFFORT_META,
  TICKET_PRIORITY_META,
  TICKET_TYPE_META,
  ticketDisplayTitle,
} from './ticket-ui'

interface TicketRowProps {
  ticket: ReswellTicket
  staff: ReswellTicketStaff[]
  currentUserId: string
  selected: boolean
  checked: boolean
  onToggleChecked: () => void
  onOpen: () => void
  onClose: () => void
  onUpdate: (patch: UpdateReswellTicketInput) => void
}

export function TicketRow({
  ticket,
  staff,
  currentUserId,
  selected,
  checked,
  onToggleChecked,
  onOpen,
  onClose,
  onUpdate,
}: TicketRowProps) {
  return (
    <tr
      className={cn(
        'group border-b border-[#e9e9e7] text-sm last:border-b-0',
        selected ? 'bg-[#e7f3f8]' : 'hover:bg-[#f7f6f3]',
      )}
    >
      <td className="w-8 px-1">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggleChecked}
          className={cn(
            'border-neutral-300',
            !checked && 'opacity-0 group-hover:opacity-100',
          )}
          aria-label={`Select ${ticketDisplayTitle(ticket)}`}
        />
      </td>
      <td className="min-w-[16rem] px-1 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 truncate text-left font-medium text-neutral-800"
          >
            {ticketDisplayTitle(ticket)}
          </button>
          {selected ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              <PanelRight className="h-3 w-3" />
              Close
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="hidden shrink-0 items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 group-hover:inline-flex"
            >
              <PanelRight className="h-3 w-3" />
              Open
            </button>
          )}
        </div>
      </td>
      <td className="w-[9rem] px-1 py-1">
        <StatusPill status={ticket.status} onChange={(status) => onUpdate({ status })} />
      </td>
      <td className="w-[11rem] px-1 py-1">
        <AssigneePicker
          assignees={ticket.assignees}
          staff={staff}
          currentUserId={currentUserId}
          compact
          onChange={(assigneeIds) => onUpdate({ assigneeIds })}
        />
      </td>
      <td className="w-[7.5rem] px-1 py-1">
        <TicketDatePicker value={ticket.dueDate} onChange={(dueDate) => onUpdate({ dueDate })} />
      </td>
      <td className="w-[7rem] px-1 py-1">
        <SelectCell
          value={ticket.priority}
          options={Object.entries(TICKET_PRIORITY_META).map(([value, meta]) => ({
            value: value as keyof typeof TICKET_PRIORITY_META,
            label: meta.label,
          }))}
          onChange={(priority) => onUpdate({ priority })}
        />
      </td>
      <td className="w-[7.5rem] px-1 py-1">
        <SelectCell
          value={ticket.taskType}
          options={Object.entries(TICKET_TYPE_META).map(([value, meta]) => ({
            value: value as keyof typeof TICKET_TYPE_META,
            label: meta.label,
          }))}
          onChange={(taskType) => onUpdate({ taskType })}
        />
      </td>
      <td className="w-[7rem] px-1 py-1">
        <SelectCell
          value={ticket.effortLevel}
          options={Object.entries(TICKET_EFFORT_META).map(([value, meta]) => ({
            value: value as keyof typeof TICKET_EFFORT_META,
            label: meta.label,
          }))}
          onChange={(effortLevel) => onUpdate({ effortLevel })}
        />
      </td>
      <td className="w-[10rem] px-1 py-1">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full truncate px-1 text-left text-neutral-500"
        >
          {ticket.description || ''}
        </button>
      </td>
    </tr>
  )
}
