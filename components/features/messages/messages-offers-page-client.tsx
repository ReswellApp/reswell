"use client"

import { useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { MessagesOffersTab } from "@/components/features/messages/messages-offers-tab"
import { cn } from "@/lib/utils"

interface MessagesOffersPageClientProps {
  userId: string
}

const groupedShell =
  "overflow-hidden rounded-[20px] border border-border/70 bg-card shadow-[0_1px_2px_rgba(17,17,17,0.04)] dark:shadow-none dark:border-border"

export function MessagesOffersPageClient({ userId }: MessagesOffersPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            Offers
          </h1>
          <p className="mt-1 text-[14px] leading-snug text-muted-foreground sm:text-[15px]">
            Active negotiations on your listings and purchases.{" "}
            <Link href="/dashboard/offers" className="font-medium text-foreground underline-offset-2 hover:underline">
              View full offer history
            </Link>
          </p>
        </div>
      </header>

      <div className="relative mb-5 shrink-0">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          placeholder="Search offers"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "h-12 rounded-2xl border-border/80 bg-muted/80 pl-11 pr-4 text-[17px] shadow-none",
            "placeholder:text-muted-foreground/80",
            "focus-visible:border-border focus-visible:ring-2 focus-visible:ring-foreground/5",
          )}
        />
      </div>

      <MessagesOffersTab userId={userId} searchQuery={searchQuery} shellClassName={groupedShell} />
    </div>
  )
}
