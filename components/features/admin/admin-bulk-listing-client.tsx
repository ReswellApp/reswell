"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  UserCog,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setImpersonation } from "@/lib/impersonation"
import { getAdminSession } from "@/app/actions/account"
import {
  ADMIN_BULK_LISTING_MAX,
  appendBulkListingSlots,
  bulkListingProgress,
  clearBulkListingSession,
  createBulkListingSession,
  isBulkListingSessionComplete,
  loadBulkListingSession,
  markBulkListingSlotInProgress,
  removeBulkListingSlot,
  type AdminBulkListingSession,
} from "@/lib/admin-bulk-listing-session"
import {
  PEER_LISTING_SECTIONS,
  PEER_LISTING_SECTION_LABELS,
  peerSellCreateHref,
  type PeerListingSection,
} from "@/lib/peer-listing-sections"
import { listingDetailHref } from "@/lib/listing-href"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SiteSearchBar, siteSearchInputClassName } from "@/components/site-search-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
}

type Phase = "pick-user" | "build-queue" | "progress"

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

export function AdminBulkListingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [users, setUsers] = useState<Profile[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [startingImpersonation, setStartingImpersonation] = useState<string | null>(null)

  const [session, setSession] = useState<AdminBulkListingSession | null>(null)
  const [phase, setPhase] = useState<Phase>("pick-user")
  const [addSection, setAddSection] = useState<PeerListingSection>("surfboards")
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
    async function loadUsers() {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .order("display_name")
      setUsers((data as Profile[]) || [])
      setUsersLoading(false)
    }
    void loadUsers()
  }, [supabase])

  useEffect(() => {
    const existing = loadBulkListingSession()
    if (existing) {
      setSession(existing)
      setPhase(existing.slots.some((s) => s.status !== "pending") ? "progress" : "build-queue")
    }
  }, [])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        u.display_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q),
    )
  }, [users, search])

  const progress = session ? bulkListingProgress(session) : null

  const startImpersonation = useCallback(
    async (user: Profile): Promise<boolean> => {
      setStartingImpersonation(user.id)
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          displayName: user.display_name || "User",
          email: user.email,
        }),
      })
      setStartingImpersonation(null)
      if (!res.ok) {
        toast.error("Failed to start — check admin permissions")
        return false
      }
      setImpersonation({
        userId: user.id,
        displayName: user.display_name || "User",
        email: user.email,
      })
      return true
    },
    [],
  )

  async function selectUser(user: Profile) {
    if (session && session.userId !== user.id) {
      if (
        !confirm(
          "Starting for a different user will clear the current bulk session. Continue?",
        )
      ) {
        return
      }
      clearBulkListingSession()
      setSession(null)
    }

    const ok = await startImpersonation(user)
    if (!ok) return

    const nextSession: AdminBulkListingSession =
      session && session.userId === user.id
        ? session
        : createBulkListingSession({
            userId: user.id,
            displayName: user.display_name || "User",
            email: user.email,
            sections: [],
          })

    setSession(nextSession)
    setPhase("build-queue")
    toast.success(`Bulk listing for ${user.display_name || "user"}`)
  }

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
    setSession(null)
    setPhase("pick-user")
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

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
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
              Create up to {ADMIN_BULK_LISTING_MAX} listings in one session — any mix of product
              types, using the same sell flows.
            </p>
          </div>
        </div>
        {session ? (
          <Button variant="outline" onClick={resetSession}>
            Clear session
          </Button>
        ) : null}
      </div>

      {doneParam && session && isBulkListingSessionComplete(session) ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-foreground">
                All {session.slots.length} listings published for {session.displayName}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Impersonation is still active — stop acting as user when you are finished.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "pick-user" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Select listing owner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SiteSearchBar className="max-w-md" onSubmit={(e) => e.preventDefault()}>
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={siteSearchInputClassName()}
                autoFocus
              />
            </SiteSearchBar>

            {usersLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No users match your search</p>
            ) : (
              <div className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    disabled={startingImpersonation !== null}
                    onClick={() => void selectUser(user)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
                      <AvatarFallback className="text-sm font-medium">
                        {(user.display_name || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.display_name || "Unnamed user"}
                      </p>
                      {user.email ? (
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      ) : null}
                    </div>
                    {startingImpersonation === user.id ? (
                      <span className="text-xs text-primary animate-pulse">Starting...</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Select</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {session && (phase === "build-queue" || phase === "progress") ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-5 w-5" />
                Queue for {session.displayName}
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
                      onValueChange={(v) => setAddSection(v as PeerListingSection)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PEER_LISTING_SECTIONS.map((section) => (
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
                    <div
                      key={slot.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
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
                  <Button
                    onClick={beginBulkUpload}
                    disabled={session.slots.length === 0}
                  >
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
              Each listing opens the standard sell form for that product type. After you publish,
              you&apos;ll return here automatically — or jump to the next pending listing. Listings
              are created on behalf of <strong>{session.displayName}</strong> via impersonation.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
