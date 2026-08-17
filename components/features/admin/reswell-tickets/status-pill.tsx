'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  RESWELL_TICKET_STATUSES,
  type ReswellTicketStatus,
} from '@/lib/types/reswellTickets'
import { TICKET_STATUS_META } from './ticket-ui'

interface StatusPillProps {
  status: ReswellTicketStatus
  onChange?: (status: ReswellTicketStatus) => void
  className?: string
}

export function StatusPill({ status, onChange, className }: StatusPillProps) {
  const meta = TICKET_STATUS_META[status]
  const pill = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        meta.pill,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  )

  if (!onChange) return pill

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#2383e2]">
          {pill}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-44 p-1">
        {RESWELL_TICKET_STATUSES.map((value) => {
          const option = TICKET_STATUS_META[value]
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100"
            >
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                  option.pill,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', option.dot)} aria-hidden />
                {option.label}
              </span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
