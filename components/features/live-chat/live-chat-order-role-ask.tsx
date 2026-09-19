"use client"

import { cn } from "@/lib/utils"
import type { LiveChatOrderRole } from "@/lib/live-chat/order-tile-intent"

interface LiveChatOrderRoleAskProps {
  onPick: (role: LiveChatOrderRole) => void
}

export function LiveChatOrderRoleAsk({ onPick }: LiveChatOrderRoleAskProps) {
  return (
    <div className="mt-2 grid shrink-0 grid-cols-2 gap-1.5">
      {(["buyer", "seller"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className={cn(
            "rounded-lg border border-border/60 bg-background px-3 py-2 text-left shadow-sm",
            "transition-colors hover:border-listingHeart/40 hover:bg-muted/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <p className="text-[11px] font-semibold text-foreground">
            {option === "buyer" ? "Bought" : "Sold"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {option === "buyer" ? "A purchase" : "A sale"}
          </p>
        </button>
      ))}
    </div>
  )
}
