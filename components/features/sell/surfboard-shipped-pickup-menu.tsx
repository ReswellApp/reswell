"use client"

import type { ProfileAddressRow } from "@/lib/profile-address"
import { cn } from "@/lib/utils"

function pickupPlaceLine(city: string, state: string, postalCode: string): string {
  const cityState = [city.trim(), state.trim()].filter(Boolean).join(", ")
  return [cityState, postalCode.trim()].filter(Boolean).join(" ")
}

export function SurfboardShippedPickupMenu({
  options,
  selectedId,
  onPick,
  onAdd,
}: {
  options: ProfileAddressRow[]
  selectedId: string | null
  onPick: (row: ProfileAddressRow) => void
  onAdd: () => void
}) {
  return (
    <>
      <div role="listbox" aria-label="Saved pickup addresses" className="max-h-64 space-y-1 overflow-y-auto">
        {options.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved California addresses.</p>
        ) : (
          options.map((row) => {
            const selected = row.id === selectedId
            return (
              <button
                key={row.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cn(
                  "w-full rounded-md px-2 py-2 text-left text-xs hover:bg-muted",
                  selected && "bg-muted",
                )}
                onClick={() => onPick(row)}
              >
                <span className="block font-medium text-foreground">{row.full_name}</span>
                <span className="block text-muted-foreground">{row.line1}</span>
                <span className="block text-muted-foreground">
                  {pickupPlaceLine(row.city, row.state ?? "", row.postal_code)}
                </span>
              </button>
            )
          })
        )}
      </div>
      <button
        type="button"
        className="mt-1 w-full rounded-md px-2 py-2 text-left text-xs font-medium text-foreground hover:bg-muted"
        onClick={onAdd}
      >
        Add address
      </button>
    </>
  )
}
