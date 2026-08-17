'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface SelectOption<T extends string> {
  value: T
  label: string
}

interface SelectCellProps<T extends string> {
  value: T | null
  options: SelectOption<T>[]
  onChange: (next: T | null) => void
  placeholder?: string
}

export function SelectCell<T extends string>({
  value,
  options,
  onChange,
  placeholder = '',
}: SelectCellProps<T>) {
  const current = options.find((option) => option.value === value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 min-w-[5.5rem] items-center rounded-sm px-1 text-left text-sm hover:bg-neutral-100"
        >
          {current ? (
            <span className="text-neutral-800">{current.label}</span>
          ) : (
            <span className="text-neutral-400">{placeholder}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-40 p-1">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100',
            !value && 'bg-neutral-50',
          )}
        >
          Empty
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100',
              value === option.value && 'bg-neutral-50',
            )}
          >
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
