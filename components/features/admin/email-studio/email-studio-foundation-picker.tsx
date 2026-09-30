"use client"

import { EMAIL_STUDIO_STARTERS } from "@/lib/email-studio/document"

export function EmailStudioFoundationPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {EMAIL_STUDIO_STARTERS.map((starter) => {
        const selected = starter.id === selectedId
        return (
          <button
            key={starter.id}
            type="button"
            aria-pressed={selected}
            className={`rounded-lg border p-3 text-left transition ${
              selected
                ? "border-[#5574AD] bg-[#5574AD]/5 ring-2 ring-[#5574AD]/15"
                : "border-border hover:border-[#5574AD]/40 hover:bg-muted/30"
            }`}
            onClick={() => onSelect(starter.id)}
          >
            <span className="block text-sm font-medium">{starter.name}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              {starter.description}
            </span>
            {starter.triggerMetric ? (
              <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                {starter.triggerMetric}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
