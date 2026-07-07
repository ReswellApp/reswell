"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Layers,
  Loader2,
  Minus,
  Plus,
  Trash2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getAdminSession } from "@/app/actions/account"
import {
  ADMIN_BULK_LISTING_MAX,
  ADMIN_BULK_LISTING_SECTIONS,
  appendBulkListingSlots,
  bulkListingProgress,
  clearBulkListingSession,
  createBulkListingSession,
  isAdminBulkListingSection,
  isBulkListingSessionComplete,
  loadBulkListingSession,
  markBulkListingSlotInProgress,
  removeBulkListingSlot,
  saveBulkListingSession,
  type AdminBulkListingSection,
  type AdminBulkListingSession,
} from "@/lib/admin-bulk-listing-session"
import {
  PEER_LISTING_SECTION_LABELS,
  peerSellCreateHref,
} from "@/lib/peer-listing-sections"
import { listingDetailHref } from "@/lib/listing-href"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Phase = "build-queue" | "progress"

interface CurrentUser {
  id: string
  displayName: string
  email: string | null
}

function slotStatusBadge(status: AdminBulkListingSession["slots"][number]["status"]) {
  if (status === "completed") {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        Complete
      </Badge>
    )
  }
  if (status === "in_progress") {
    return (
      <Badge className="border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400">
        In progress
      </Badge>
    )
  }
  return <Badge variant="outline">Pending</Badge>
}

function sanitizeSession(session: AdminBulkListingSession): AdminBulkListingSession {
  const sanitizedSlots = session.slots.filter((slot) => isAdminBulkListingSection(slot.section))
  if (sanitizedSlots.length === session.slots.length) return session
  return { ...session, slots: sanitizedSlots }
}

export function AdminBulkListingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [session, setSession] = useState<AdminBulkListingSession | null>(null)
  const [phase, setPhase] = useState<Phase>("build-queue")
  const [addSection, setAddSection] = useState<AdminBulkListingSection>("surfboards")
  const [addCount, setAddCount] = useState(1)

  const doneParam = searchParams.get("done") === "1"

  useEffect(() => {
    let cancelled = false
    getAdminSession()
      .then((d) => {
        if (!cancelled) setIsAdmin(d.isAdmin === true)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCurrentUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setCurrentUser(null)
          setAuthLoading(false)
        }
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("id", user.id)
        .maybeSingle()

      if (!cancelled) {
        setCurrentUser({
          id: user.id,
          displayName: profile?.display_name?.trim() || user.email || "You",
          email: profile?.email ?? user.email ?? null,
        })
        setAuthLoading(false)
      }
    }

    void loadCurrentUser()
    return () => {
      cancelled = true
    }
  }, [supabase])

  useEffect(() => {
    if (!currentUser) return

    const existing = loadBulkListingSession()
    if (existing && existing.userId !== currentUser.id) {
      clearBulkListingSession()
    }

    const baseSession =
      existing && existing.userId === currentUser.id
        ? existing
        : createBulkListingSession({
            userId: currentUser.id,
            displayName: currentUser.displayName,
            email: currentUser.email,
            sections: [],
          })

    const sanitized = sanitizeSession(baseSession)
    if (sanitized !== baseSession) {
      saveBulkListingSession(sanitized)
    }

    setSession(sanitized)
    setPhase(sanitized.slots.some((s) => s.status !== "pending") ? "progress" : "build-queue")
  }, [currentUser])

  const progress = session ? bulkListingProgress(session) : null

  function addSlotsToQueue() {
    if (!session) return
    const remaining = ADMIN_BULK_LISTING_MAX - session.slots.length
    if (remaining <= 0) {
      toast.error(`Maximum ${ADMIN_BULK_LISTING_MAX} listings per bulk session`)
      return
    }
    const count = Math.min(Math.max(1, addCount), remaining)
    const sections = Array.from({ length: count }, () => addSection)
    const updated = appendBulkListingSlots(session, sections)
    if (!updated) {
      toast.error(`Maximum ${ADMIN_BULK_LISTING_MAX} listings per bulk session`)
      return
    }
    setSession(updated)
    toast.success(`Added ${count} ${PEER_LISTING_SECTION_LABELS[addSection]} slot${count === 1 ? "" : "s"}`)
  }

  function removeSlot(slotId: string) {
    if (!session) return
    const slot = session.slots.find((s) => s.id === slotId)
    if (slot?.status === "completed") {
      toast.error("Completed listings cannot be removed from the queue")
      return
    }
    const updated = removeBulkListingSlot(session, slotId)
    setSession(updated)
  }

  function beginBulkUpload() {
    if (!session || session.slots.length === 0) {
      toast.error("Add at least one listing to the queue")
      return
    }
    const firstPending =
      session.slots.find((s) => s.status === "pending") ??
      session.slots.find((s) => s.status === "in_progress")
    if (!firstPending) {
      setPhase("progress")
      return
    }
    const updated = markBulkListingSlotInProgress(session, firstPending.id)
    setSession(updated)
    setPhase("progress")
    router.push(peerSellCreateHref(firstPending.section, firstPending.id))
  }

  function continueSlot(slotId: string) {
    if (!session) return
    const slot = session.slots.find((s) => s.id === slotId)
    if (!slot || slot.status === "completed") return
    const updated = markBulkListingSlotInProgress(session, slotId)
    setSession(updated)
    router.push(peerSellCreateHref(slot.section, slot.id))
  }

  function resetSession() {
    if (
      session &&
      session.slots.some((s) => s.status === "completed") &&
      !confirm("Clear this bulk session? Completed listing links will be lost from this view.")
    ) {
      return
    }
    clearBulkListingSession()
    if (currentUser) {
      const next = createBulkListingSession({
        userId: currentUser.id,
        displayName: currentUser.displayName,
        email: currentUser.email,
        sections: [],
      })
      setSession(next)
      setPhase("build-queue")
    } else {
      setSession(null)
    }
    router.replace("/admin/listings/bulk")
  }

  if (isAdmin === false) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="font-medium text-foreground">Admin access required</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Bulk listing is available to full admins only.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    )
  }

  if (isAdmin === null || authLoading || !session) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="font-medium text-foreground">Sign in required</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your admin account to bulk list listings.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/auth/login?redirect=/admin/listings/bulk">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/listings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bulk list listings</h1>
            <p className="text-muted-foreground">
              Create up to {ADMIN_BULK_LISTING_MAX} surfboards, fins, or magazines in one session
              under your account ({currentUser.displayName}).
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={resetSession}>
          Clear session
        </Button>
      </div>

      {doneParam && isBulkListingSessionComplete(session) ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-foreground">
                All {session.slots.length} listings published
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your bulk session is complete. Clear the session to start a new batch.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-5 w-5" />
            Your listing queue
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {progress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.completed} of {progress.total} complete
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {ADMIN_BULK_LISTING_MAX - progress.total} slots remaining
                </span>
              </div>
              <Progress
                value={progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}
              />
            </div>
          ) : null}

          {phase === "build-queue" || progress!.total < ADMIN_BULK_LISTING_MAX ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium">Add to queue</p>
                <Select
                  value={addSection}
                  onValueChange={(v) => setAddSection(v as AdminBulkListingSection)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_BULK_LISTING_SECTIONS.map((section) => (
                      <SelectItem key={section} value={section}>
                        {PEER_LISTING_SECTION_LABELS[section]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={addCount <= 1}
                  onClick={() => setAddCount((c) => Math.max(1, c - 1))}
                  aria-label="Decrease count"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">{addCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setAddCount((c) =>
                      Math.min(c + 1, ADMIN_BULK_LISTING_MAX - (session?.slots.length ?? 0)),
                    )
                  }
                  aria-label="Increase count"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button type="button" onClick={addSlotsToQueue}>
                  Add
                </Button>
              </div>
            </div>
          ) : null}

          {session.slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Add listing types above to build your queue (max {ADMIN_BULK_LISTING_MAX}).
            </p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {session.slots.map((slot, index) => (
                <div key={slot.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {PEER_LISTING_SECTION_LABELS[slot.section]}
                    </p>
                    {slot.title ? (
                      <p className="truncate text-xs text-muted-foreground">{slot.title}</p>
                    ) : null}
                  </div>
                  {slotStatusBadge(slot.status)}
                  <div className="flex items-center gap-2">
                    {slot.status === "completed" && slot.listingId ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          href={listingDetailHref({
                            id: slot.listingId,
                            slug: slot.listingSlug,
                            section: slot.section,
                          })}
                        >
                          View
                          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={slot.status === "in_progress" ? "default" : "outline"}
                        onClick={() => continueSlot(slot.id)}
                      >
                        {slot.status === "in_progress" ? "Continue" : "Fill listing"}
                      </Button>
                    )}
                    {slot.status !== "completed" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeSlot(slot.id)}
                        aria-label="Remove slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {phase === "build-queue" ? (
              <Button onClick={beginBulkUpload} disabled={session.slots.length === 0}>
                Start bulk upload
              </Button>
            ) : null}
            {phase === "progress" && progress && progress.pending > 0 ? (
              <Button onClick={beginBulkUpload}>Continue next listing</Button>
            ) : null}
            <Button variant="outline" asChild>
              <Link href="/admin/listings">View all listings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <Circle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Each listing opens the standard sell form for surfboards, fins, or magazines. After you
          publish, you&apos;ll return here automatically — or jump to the next pending listing.
          Surfboards and fins publish under your account. Magazine listings use the configured
          magazine seller profile.
        </p>
      </div>
    </div>
  )
}
