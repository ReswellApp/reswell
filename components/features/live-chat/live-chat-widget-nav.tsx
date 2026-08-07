"use client"

import { HelpCircle, Home, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type LiveChatWidgetTab = "home" | "messages" | "help"

interface LiveChatWidgetNavProps {
  active: LiveChatWidgetTab
  onChange: (tab: LiveChatWidgetTab) => void
  hasUnreadMessages?: boolean
}

const TABS: Array<{ id: LiveChatWidgetTab; label: string; icon: typeof Home }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "messages", label: "Chat", icon: MessageCircle },
  { id: "help", label: "Help", icon: HelpCircle },
]

export function LiveChatWidgetNav({ active, onChange, hasUnreadMessages }: LiveChatWidgetNavProps) {
  return (
    <nav
      className="grid grid-cols-3 border-t border-border/50 bg-background/95 backdrop-blur-sm"
      aria-label="Live chat sections"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 px-2 py-2.5 text-[11px] font-medium transition-colors",
              isActive ? "text-listingHeart" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
            {isActive ? (
              <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-listingHeart" aria-hidden />
            ) : null}
            {id === "messages" && hasUnreadMessages ? (
              <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-listingHeart" aria-hidden />
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
