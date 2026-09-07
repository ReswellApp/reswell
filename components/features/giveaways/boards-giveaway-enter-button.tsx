"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Gift } from "lucide-react"
import { SellGiveawayEnterDialog } from "@/components/features/giveaways/sell-giveaway-enter-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Giveaway } from "@/lib/types/giveaways"

export type BoardsGiveawayEnterProps = {
  giveaway: Giveaway
}

type BoardsGiveawayEnterControlsProps = BoardsGiveawayEnterProps & {
  children: (controls: {
    desktopButton: ReactNode
    mobileButton: ReactNode
  }) => ReactNode
}

type EntryProbe = {
  ready: boolean
  /** Guests and users without an entry see the CTA. */
  show: boolean
  isLoggedIn: boolean
}

/**
 * Shared open/hide state for the `/boards` giveaway CTA across the hero and
 * mobile hover bar. Hides for signed-in users who already have an entry.
 */
export function BoardsGiveawayEnterControls({
  giveaway,
  children,
}: BoardsGiveawayEnterControlsProps) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [probe, setProbe] = useState<EntryProbe>({
    ready: false,
    show: false,
    isLoggedIn: false,
  })

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/giveaways/${encodeURIComponent(giveaway.slug)}/entry`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 401) {
          setProbe({ ready: true, show: true, isLoggedIn: false })
          return
        }
        if (!res.ok) {
          setProbe({ ready: true, show: true, isLoggedIn: true })
          return
        }
        const json = (await res.json()) as {
          data?: { entry?: unknown | null }
        }
        const hasEntry = Boolean(json.data?.entry)
        setProbe({
          ready: true,
          show: !hasEntry,
          isLoggedIn: true,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setProbe({ ready: true, show: true, isLoggedIn: false })
      })
    return () => controller.abort()
  }, [giveaway.slug])

  if (!probe.ready || !probe.show || dismissed) {
    return <>{children({ desktopButton: null, mobileButton: null })}</>
  }

  const trigger = (compact: boolean) => (
    <Button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "shrink-0 gap-1.5 rounded-full border-transparent bg-listingHeart text-sm font-semibold text-white shadow-none hover:bg-[#2a4170]",
        compact
          ? "h-11 min-w-0 flex-1 px-2.5 sm:flex-none sm:px-4"
          : "h-10 px-4",
      )}
    >
      <Gift className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{compact ? "Giveaway" : "Enter giveaway"}</span>
    </Button>
  )

  return (
    <>
      {children({
        desktopButton: trigger(false),
        mobileButton: trigger(true),
      })}
      <SellGiveawayEnterDialog
        open={open}
        giveaway={giveaway}
        isLoggedIn={probe.isLoggedIn}
        surface="boards"
        onOpenChange={setOpen}
        onEntered={() => {
          setOpen(false)
          setDismissed(true)
        }}
      />
    </>
  )
}
