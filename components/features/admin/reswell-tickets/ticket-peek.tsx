'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, MoreHorizontal, Trash2, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ReswellTicket, ReswellTicketFileKind, ReswellTicketStaff } from '@/lib/types/reswellTickets'
import type { UpdateReswellTicketInput } from '@/lib/validations/reswellTickets'
import { AssigneePicker } from './assignee-picker'
import { TicketDatePicker } from './date-picker'
import { StatusPill } from './status-pill'
import { TicketPeekSections } from './ticket-peek-sections'
import { ticketDisplayTitle } from './ticket-ui'

interface TicketPeekProps {
  ticket: ReswellTicket
  staff: ReswellTicketStaff[]
  currentUserId: string
  onUpdate: (patch: UpdateReswellTicketInput) => void
  onDelete: () => void
  onAddComment: (body: string) => void
  onDeleteComment: (id: string) => void
  onAddSubtask: () => void
  onUpdateSubtask: (patch: { id: string; title?: string; completed?: boolean }) => void
  onDeleteSubtask: (id: string) => void
  onAddFile: (input: { kind: ReswellTicketFileKind; url: string }) => void
  onDeleteFile: (id: string) => void
  onUploadImages: (files: File[]) => Promise<void>
  onClose: () => void
}

export function TicketPeek({
  ticket,
  staff,
  currentUserId,
  onUpdate,
  onDelete,
  onAddComment,
  onDeleteComment,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onAddFile,
  onDeleteFile,
  onUploadImages,
  onClose,
}: TicketPeekProps) {
  const [title, setTitle] = useState(ticket.title)
  const currentUser = staff.find((person) => person.id === currentUserId) ?? null

  useEffect(() => {
    setTitle(ticket.title)
  }, [ticket.id, ticket.title])

  return (
    <aside className="flex h-full min-h-[40rem] w-full flex-col border-l border-[#e9e9e7] bg-white lg:w-[380px] xl:w-[420px]">
      <div className="flex items-center justify-end gap-1 px-4 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Ticket actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-red-600"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <CheckCircle2 className="mb-3 h-7 w-7 text-emerald-500" aria-hidden />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title !== ticket.title) onUpdate({ title })
          }}
          placeholder="Untitled"
          className="w-full border-0 bg-transparent text-2xl font-bold tracking-tight text-neutral-900 outline-none"
        />
        <p className="mt-1 text-sm text-neutral-400">View details</p>

        <dl className="mt-6 grid grid-cols-[7rem_1fr] items-center gap-y-3 text-sm">
          <dt className="text-neutral-500">Assignee</dt>
          <dd>
            <AssigneePicker
              assignees={ticket.assignees}
              staff={staff}
              currentUserId={currentUserId}
              onChange={(assigneeIds) => onUpdate({ assigneeIds })}
            />
          </dd>
          <dt className="text-neutral-500">Status</dt>
          <dd>
            <StatusPill status={ticket.status} onChange={(status) => onUpdate({ status })} />
          </dd>
          <dt className="text-neutral-500">Due date</dt>
          <dd>
            <TicketDatePicker
              value={ticket.dueDate}
              onChange={(dueDate) => onUpdate({ dueDate })}
              placeholder="Empty"
            />
          </dd>
        </dl>

        <div className="mt-8">
          <TicketPeekSections
            ticket={ticket}
            currentUser={currentUser}
            onDescriptionChange={(description) => onUpdate({ description })}
            onAddComment={onAddComment}
            onDeleteComment={onDeleteComment}
            onAddSubtask={onAddSubtask}
            onUpdateSubtask={onUpdateSubtask}
            onDeleteSubtask={onDeleteSubtask}
            onAddFile={onAddFile}
            onDeleteFile={onDeleteFile}
            onUploadImages={onUploadImages}
          />
        </div>
      </div>
      <span className="sr-only">{ticketDisplayTitle(ticket)}</span>
    </aside>
  )
}
