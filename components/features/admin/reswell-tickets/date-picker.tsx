'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { formatTicketDate, parseTicketDateInput } from './ticket-ui'

interface TicketDatePickerProps {
  value: string | null
  onChange: (next: string | null) => void
  placeholder?: string
}

function toDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function TicketDatePicker({
  value,
  onChange,
  placeholder = '',
}: TicketDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(formatTicketDate(value))
  const selected = toDate(value)

  function commitText(next: string) {
    const parsed = parseTicketDateInput(next)
    if (parsed) onChange(parsed)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft(formatTicketDate(value))
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-[6.5rem] items-center rounded-sm px-1 text-left text-sm text-neutral-800 hover:bg-neutral-100"
        >
          {value ? formatTicketDate(value) : <span className="text-neutral-400">{placeholder}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commitText(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitText(draft)
          }}
          className="mb-3 h-8 text-sm"
        />
        <div className="mb-1 flex items-center justify-end px-1">
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-[#2383e2] hover:bg-blue-50"
            onClick={() => onChange(toIso(new Date()))}
          >
            Today
          </button>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => onChange(date ? toIso(date) : null)}
          className="p-0"
          classNames={{
            day_selected:
              'bg-[#2383e2] text-white hover:bg-[#2383e2] hover:text-white focus:bg-[#2383e2] focus:text-white rounded-md',
          }}
        />
        <button
          type="button"
          className={cn(
            'mt-2 text-sm text-neutral-600 hover:text-neutral-900',
            !value && 'opacity-50',
          )}
          onClick={() => {
            onChange(null)
            setDraft('')
          }}
        >
          Clear
        </button>
      </PopoverContent>
    </Popover>
  )
}
