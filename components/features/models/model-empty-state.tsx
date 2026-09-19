"use client"

import { useState } from "react"
import { Check, Heart, Loader2 } from "lucide-react"
import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { Button } from "@/components/ui/button"
import { createBoardSavedSearchAction } from "@/lib/actions/boardSavedSearch"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import { useToast } from "@/hooks/use-toast"

export function ModelEmptyState({
  modelName,
  brandName,
  criteria,
  isLoggedIn,
}: {
  modelName: string
  brandName: string
  criteria: BoardSavedSearchCriteria
  isLoggedIn: boolean
}) {
  const openSignIn = useSignInGate()
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!isLoggedIn) {
      openSignIn(undefined, { skipSessionProbe: true })
      return
    }

    setPending(true)
    const res = await createBoardSavedSearchAction({
      criteria,
      emailNotificationsEnabled: true,
      label: `${brandName} ${modelName}`,
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

    setSaved(true)
    toast({
      title: "Search saved",
      description: `We'll email you when a ${brandName} ${modelName} is listed on Reswell.`,
    })
  }

  return (
    <section
      className="rounded-2xl bg-neutral-100 px-6 py-12 text-center sm:px-10 sm:py-16"
      aria-labelledby="model-empty-heading"
    >
      <h2
        id="model-empty-heading"
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        We currently don&apos;t have this model on the site
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-foreground/80 sm:text-base">
        Save this search and get notified when a {brandName} {modelName} pops up on Reswell.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-6 rounded-full bg-background px-5 font-medium shadow-none"
        disabled={pending || saved}
        onClick={() => void handleSave()}
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : saved ? (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden />
            Search saved
          </>
        ) : (
          <>
            <Heart className="mr-2 h-4 w-4" aria-hidden />
            Save this search
          </>
        )}
      </Button>
    </section>
  )
}
