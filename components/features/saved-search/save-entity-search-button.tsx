"use client"

import { useState } from "react"
import { Check, Heart, Loader2 } from "lucide-react"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button } from "@/components/ui/button"
import {
  createBoardSavedSearchAction,
  deleteBoardSavedSearchAction,
} from "@/lib/actions/boardSavedSearch"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export type SaveEntitySearchButtonProps = {
  criteria: BoardSavedSearchCriteria
  label: string
  savedLabel?: string
  /** Stored on the saved-search row (Board Finder list). Defaults to `label`. */
  savedSearchLabel?: string
  successTitle: string
  successDescription: string
  isLoggedIn: boolean
  initialSavedSearchId?: string | null
  className?: string
  size?: "default" | "sm"
}

export function SaveEntitySearchButton({
  criteria,
  label,
  savedLabel = "Saved",
  savedSearchLabel,
  successTitle,
  successDescription,
  isLoggedIn,
  initialSavedSearchId = null,
  className,
  size = "default",
}: SaveEntitySearchButtonProps) {
  const openSignIn = useSignInGate()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [savedSearchId, setSavedSearchId] = useState<string | null>(initialSavedSearchId)
  const [hovering, setHovering] = useState(false)
  const saved = Boolean(savedSearchId)

  async function handleClick() {
    if (!isLoggedIn) {
      openSignIn(undefined, { skipSessionProbe: true })
      return
    }

    setPending(true)
    if (savedSearchId) {
      const res = await deleteBoardSavedSearchAction({ id: savedSearchId })
      setPending(false)
      if ("error" in res) {
        if (res.error === "Sign in to manage saved searches.") {
          openSignIn()
          return
        }
        toast({
          title: "Could not unsave",
          description: res.error,
          variant: "destructive",
        })
        return
      }
      setSavedSearchId(null)
      toast({ title: "Alert removed" })
      return
    }

    const res = await createBoardSavedSearchAction({
      criteria,
      emailNotificationsEnabled: true,
      label: savedSearchLabel ?? label,
    })
    setPending(false)

    if ("error" in res) {
      if (res.error === "Sign in to save a search.") {
        openSignIn()
        return
      }
      toast({
        title: "Could not save",
        description: res.error,
        variant: "destructive",
      })
      return
    }

    setSavedSearchId(res.id)
    toast({
      title: successTitle,
      description: successDescription,
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn(
        "rounded-full font-medium shadow-none",
        saved &&
          !hovering &&
          "border-listingHeart/40 bg-listingHeart/5 text-listingHeart hover:bg-listingHeart/10",
        className,
      )}
      disabled={pending}
      onClick={() => void handleClick()}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      aria-pressed={saved}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {saved ? "Removing…" : "Saving…"}
        </>
      ) : saved ? (
        <>
          {hovering ? (
            <>
              <Heart className="h-4 w-4" aria-hidden />
              Unsave
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden />
              {savedLabel}
            </>
          )}
        </>
      ) : (
        <>
          <Heart className="h-4 w-4" aria-hidden />
          {label}
        </>
      )}
    </Button>
  )
}
