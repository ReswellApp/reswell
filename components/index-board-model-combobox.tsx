"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { INDEX_DIRECTORY_BASE } from "@/lib/index-directory/routes"

export type IndexBoardModelSelection = {
  brandSlug: string
  modelSlug: string
  brandName: string
  modelName: string
  label: string
}

export function IndexBoardModelCombobox({
  value,
  onChange,
  disabled,
}: {
  value: IndexBoardModelSelection | null
  onChange: (next: IndexBoardModelSelection | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<IndexBoardModelSelection[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch("/api/index-directory/board-models")
      .then((r) => {
        if (!r.ok) throw new Error("bad response")
        return r.json()
      })
      .then((data: { items: IndexBoardModelSelection[] }) => {
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : [])
          setLoadError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load board index")
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal min-h-touch"
          >
            <span className={cn("truncate text-left", !value?.label && "text-muted-foreground")}>
              {value?.label ?? "Search brand index…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[min(100vw-2rem,22rem)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type brand or model…" />
            <CommandList className="max-h-[min(320px,50vh)]">
              <CommandEmpty>
                {loadError
                  ? loadError
                  : items.length === 0
                    ? "Loading directory…"
                    : "No matching model."}
              </CommandEmpty>
              <CommandGroup>
                {items.map((opt) => (
                  <CommandItem
                    key={`${opt.brandSlug}/${opt.modelSlug}`}
                    value={`${opt.label} ${opt.brandSlug} ${opt.modelSlug}`}
                    onSelect={() => {
                      onChange(opt)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value?.brandSlug === opt.brandSlug && value?.modelSlug === opt.modelSlug
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
          <a
            href={`${INDEX_DIRECTORY_BASE}/brands/${value.brandSlug}/models/${value.modelSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Open in index
          </a>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Optional. Matches your board to Reswell&apos;s brand directory so buyers can compare models. Skip for
        one-offs or customs.
      </p>
    </div>
  )
}
