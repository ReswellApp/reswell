"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { requestBoardListingAction } from "@/lib/actions/boardListingRequest"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import type { BoardListingRequestSource } from "@/lib/validations/boardListingRequest"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import { CheckCircle2, Loader2, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

export function BoardsNoResultsRequestPanel({
  className,
  query,
  criteria,
  source,
}: {
  className?: string
  /** Raw keyword the shopper searched, when present. */
  query?: string
  /** Filter snapshot at the dead end (drives the "we'll look for" summary). */
  criteria?: BoardSavedSearchCriteria
  source: BoardListingRequestSource
}) {
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail((prev) => prev || user.email!)
    })
  }, [])

  const trimmedQuery = query?.trim() || ""
  const summary = criteria ? boardSavedSearchCriteriaSummary(criteria) : ""
  const lookingForLabel =
    summary && summary.toLowerCase() !== "all surfboards"
      ? summary
      : trimmedQuery
        ? `“${trimmedQuery}”`
        : ""

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    const res = await requestBoardListingAction({
      email,
      query: trimmedQuery || undefined,
      criteria: criteria ?? {},
      source,
    })
    setPending(false)

    if ("error" in res) {
      toast({
        title: "Could not submit",
        description: res.error,
        variant: "destructive",
      })
      return
    }

    setSubmitted(true)
    toast({
      title: "We're on it",
      description: "We'll email you the moment a matching board is listed.",
    })
  }

  return (
    <section
      className={cn(
        "mx-auto mt-8 max-w-lg rounded-2xl border border-border bg-background p-6 text-left shadow-sm",
        className,
      )}
      aria-labelledby="boards-no-results-request-heading"
    >
      {submitted ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-base font-semibold text-foreground">Request received</h3>
          <p className="text-sm text-muted-foreground">
            We&apos;ll source it and email{" "}
            <span className="font-medium text-foreground">{email}</span> the moment a matching board
            is listed.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h3
                id="boards-no-results-request-heading"
                className="text-base font-semibold text-foreground"
              >
                Can&apos;t find it? Let Reswell find a seller.
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                We&apos;ll go source it and email you the moment a matching board is listed.
                {lookingForLabel ? (
                  <>
                    {" "}
                    We&apos;ll look for{" "}
                    <span className="font-medium text-foreground">{lookingForLabel}</span>.
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="boards-no-results-email" className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id="boards-no-results-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </div>
            <Button type="submit" className="w-full rounded-full" disabled={pending || !email.trim()}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Notify me when it's listed"
              )}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              One email when we find a match. No spam.
            </p>
          </form>
        </>
      )}
    </section>
  )
}
