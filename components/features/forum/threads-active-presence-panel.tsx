"use client"

import { Eye, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useThreadsPresence } from "@/components/features/forum/threads-presence-context"
import {
  threadsAvatarFallbackClassName,
  threadsPresenceDotClassName,
  threadsPresencePingClassName,
} from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type ThreadsActivePresencePanelProps = {
  className?: string
}

function memberInitial(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function ThreadsActivePresencePanel({ className }: ThreadsActivePresencePanelProps) {
  const { members, guestCount } = useThreadsPresence()

  const memberNames = members
    .map((member) => member.displayName?.trim())
    .filter((name): name is string => Boolean(name))

  return (
    <aside
      className={cn("rounded-xl border border-border/60 bg-card shadow-sm", className)}
      aria-live="polite"
    >
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                threadsPresencePingClassName,
              )}
            />
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", threadsPresenceDotClassName)} />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Live on Threads</h2>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <section aria-label="Active users">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Active users
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{members.length}</p>
          {memberNames.length > 0 ? (
            <div className="mt-3 space-y-3">
              <div className="flex -space-x-2">
                {memberNames.slice(0, 5).map((name, index) => (
                  <Avatar
                    key={`${name}-${index}`}
                    className="h-7 w-7 border-2 border-background ring-1 ring-border/40"
                    title={name}
                  >
                    <AvatarFallback className={cn("text-[10px]", threadsAvatarFallbackClassName)}>
                      {memberInitial(name)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <p className="text-sm leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">{memberNames.slice(0, 3).join(", ")}</span>
                {memberNames.length > 3 ? ` +${memberNames.length - 3} more` : ""}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No signed-in members browsing right now.</p>
          )}
        </section>

        <div className="h-px bg-border/60" aria-hidden />

        <section aria-label="Active visitors">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Active visitors
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{guestCount}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {guestCount === 0
              ? "No guests browsing right now."
              : `${guestCount} guest${guestCount === 1 ? "" : "s"} browsing without signing in.`}
          </p>
        </section>
      </div>
    </aside>
  )
}
