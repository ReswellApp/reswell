import { LIVE_CHAT_ADMIN_ONLY_LABEL, LIVE_CHAT_WIDGET_ADMIN_ONLY } from "@/lib/live-chat/widget-config"
import { cn } from "@/lib/utils"

interface LiveChatAdminOnlyBadgeProps {
  className?: string
  /** White chip for the dark home header. */
  onPrimary?: boolean
}

export function LiveChatAdminOnlyBadge({ className, onPrimary = false }: LiveChatAdminOnlyBadgeProps) {
  if (!LIVE_CHAT_WIDGET_ADMIN_ONLY) return null
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        onPrimary ? "bg-white/20 text-white" : "bg-violet-100 text-violet-800",
        className,
      )}
    >
      {LIVE_CHAT_ADMIN_ONLY_LABEL}
    </span>
  )
}
