'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { ReswellTicketStaff } from '@/lib/types/reswellTickets'
import { StaffAvatar } from './staff-avatar'

interface AssigneePickerProps {
  assignees: ReswellTicketStaff[]
  staff: ReswellTicketStaff[]
  currentUserId: string
  onChange: (assigneeIds: string[]) => void
  compact?: boolean
}

export function AssigneePicker({
  assignees,
  staff,
  currentUserId,
  onChange,
  compact = false,
}: AssigneePickerProps) {
  const [query, setQuery] = useState('')
  const selectedIds = new Set(assignees.map((person) => person.id))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return staff
    return staff.filter(
      (person) =>
        person.name.toLowerCase().includes(q) ||
        (person.email ?? '').toLowerCase().includes(q),
    )
  }, [query, staff])

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-h-7 w-full items-center gap-1.5 rounded-sm px-1 text-left hover:bg-neutral-100',
            compact ? 'min-w-[8rem]' : 'min-h-8',
          )}
        >
          {assignees.length === 0 ? (
            <span className="text-sm text-neutral-400">{compact ? '' : 'Empty'}</span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              {assignees.slice(0, 3).map((person) => (
                <span key={person.id} className="flex min-w-0 items-center gap-1.5">
                  <StaffAvatar person={person} size="xs" />
                  {!compact || assignees.length === 1 ? (
                    <span className="truncate text-sm text-neutral-800">{person.name}</span>
                  ) : null}
                </span>
              ))}
              {assignees.length > 3 ? (
                <span className="text-xs text-neutral-500">+{assignees.length - 3}</span>
              ) : null}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for people or groups..."
          className="h-8 text-sm"
        />
        <p className="px-1 pb-1 pt-2 text-xs text-neutral-500">Select as many as you like</p>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((person) => {
            const selected = selectedIds.has(person.id)
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-neutral-100"
              >
                <StaffAvatar person={person} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
                  {person.name}
                  {person.id === currentUserId ? (
                    <span className="ml-1 text-neutral-400">(You)</span>
                  ) : null}
                </span>
                {selected ? <Check className="h-4 w-4 text-neutral-700" /> : null}
              </button>
            )
          })}
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-500">No people match.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
