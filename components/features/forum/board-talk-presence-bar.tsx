"use client"

import { Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useBoardTalkPresence } from "@/components/features/forum/hooks/use-board-talk-presence"
import {
  threadsPresenceDotClassName,
  threadsPresencePingClassName,
} from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type BoardTalkPresenceBarProps = {
  userId: string | null
  displayName: string | null
  className?: string
}

function memberInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function BoardTalkPresenceBar({ userId, displayName, className }: BoardTalkPresenceBarProps) {
  const { members, guestCount, total } = useBoardTalkPresence(displayName, userId)

  if (total === 0) return null

  const memberNames = members
    .map((m) => m.displayName?.trim())
    .filter((n): n is string => Boolean(n))

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 text-sm shadow-sm backdrop-blur-sm",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-foreground">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", threadsPresencePingClassName)} />
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", threadsPresenceDotClassName)} />
        </span>
        <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="font-medium tabular-nums">
          {total} {total === 1 ? "person" : "people"} here
        </span>
      </div>

      {memberNames.length > 0 ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div className="flex -space-x-2">
            {memberNames.slice(0, 6).map((name, i) => (
              <Avatar
                key={`${name}-${i}`}
                className="h-7 w-7 border-2 border-background ring-1 ring-border/50"
              >
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {memberInitial(name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <p className="min-w-0 text-muted-foreground">
            <span className="font-medium text-foreground">{memberNames.slice(0, 4).join(", ")}</span>
            {memberNames.length > 4 ? ` +${memberNames.length - 4} more` : ""}
            {guestCount > 0 ? (
              <span>
                {" "}
                · {guestCount} guest{guestCount !== 1 ? "s" : ""} browsing
              </span>
            ) : null}
          </p>
        </div>
      ) : guestCount > 0 ? (
        <p className="text-muted-foreground">
          {guestCount} guest{guestCount !== 1 ? "s" : ""} browsing
        </p>
      ) : null}
    </div>
  )
}
