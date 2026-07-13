import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { ForumThreadParticipant } from "@/lib/services/forumThreads"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { threadsAvatarFallbackClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

type ThreadsParticipantStackProps = {
  participants: ForumThreadParticipant[]
  max?: number
  size?: "sm" | "md"
  className?: string
}

const SIZE = {
  sm: "h-6 w-6 text-[9px]",
  md: "h-7 w-7 text-[10px]",
} as const

export function ThreadsParticipantStack({
  participants,
  max = 5,
  size = "sm",
  className,
}: ThreadsParticipantStackProps) {
  const shown = participants.slice(0, max)
  if (shown.length === 0) return null

  return (
    <div className={cn("flex -space-x-2", className)} aria-hidden>
      {shown.map((p) => {
        const initial = p.displayName.charAt(0).toUpperCase()
        return (
          <Avatar
            key={p.userId}
            className={cn(SIZE[size], "border-2 border-background ring-1 ring-border/40")}
            title={p.displayName}
          >
            <AvatarImage src={profileMediaDisplaySrc(p.avatarUrl || "")} alt="" />
            <AvatarFallback className={threadsAvatarFallbackClassName}>{initial}</AvatarFallback>
          </Avatar>
        )
      })}
    </div>
  )
}
