"use client"

import { cn } from "@/lib/utils"

export type SupportHubChoice = {
  id: string
  title: string
  hint?: string
}

interface SupportHubChoiceCardsProps {
  choices: readonly SupportHubChoice[]
  onPick: (id: string) => void
  columns?: "one" | "responsive"
}

export function SupportHubChoiceCards({
  choices,
  onPick,
  columns = "responsive",
}: SupportHubChoiceCardsProps) {
  return (
    <ul
      className={cn(
        "grid gap-3",
        columns === "responsive" && "grid-cols-1 sm:grid-cols-2",
      )}
      role="list"
    >
      {choices.map((choice) => (
        <li key={choice.id}>
          <button
            type="button"
            onClick={() => onPick(choice.id)}
            className={cn(
              "flex h-full min-h-[5.5rem] w-full flex-col items-center justify-center rounded-2xl border border-border/70 bg-card px-4 py-5 text-center shadow-sm transition-colors",
              "hover:border-listingHeart/35 hover:bg-listingHeart/[0.04]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-listingHeart",
            )}
          >
            <span className="text-[14px] font-semibold leading-snug text-foreground">
              {choice.title}
            </span>
            {choice.hint ? (
              <span className="mt-1 text-[12px] leading-snug text-muted-foreground">
                {choice.hint}
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
