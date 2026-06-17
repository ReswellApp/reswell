"use client"

import { Handshake, ShoppingCart } from "lucide-react"
import { cn } from "@/lib/utils"

interface OffersEmptyStateProps {
  role: "seller" | "buyer"
  className?: string
}

export function OffersEmptyState({ role, className }: OffersEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center sm:py-16", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        {role === "seller" ? (
          <Handshake className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        ) : (
          <ShoppingCart className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} aria-hidden />
        )}
      </div>

      {role === "seller" ? (
        <>
          <h2 className="text-[17px] font-semibold text-foreground">
            No offers available to send yet
          </h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Your eligible offers will show up here when buyers save your boards or add them to
            cart. Make sure you have boards listed for sale to receive offers.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-[17px] font-semibold text-foreground">No offers yet</h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Offers you make on a listing appear here. Browse boards and tap Make an offer to start
            negotiating with a seller.
          </p>
        </>
      )}
    </div>
  )
}
