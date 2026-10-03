"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MessageFilterType = "recent" | "oldest" | "unresponded"

interface MessagesInboxFilterProps {
  value: MessageFilterType
  onChange: (value: MessageFilterType) => void
  className?: string
}

export function MessagesInboxFilter({ value, onChange, className }: MessagesInboxFilterProps) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-border/40 py-2", className)}>
      <Button
        variant={value === "recent" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("recent")}
        className="h-7 rounded-full px-3 text-xs"
      >
        Most Recent
      </Button>
      <Button
        variant={value === "oldest" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("oldest")}
        className="h-7 rounded-full px-3 text-xs"
      >
        Oldest
      </Button>
      <Button
        variant={value === "unresponded" ? "default" : "ghost"}
        size="sm"
        onClick={() => onChange("unresponded")}
        className="h-7 rounded-full px-3 text-xs"
      >
        Unresponded
      </Button>
    </div>
  )
}
