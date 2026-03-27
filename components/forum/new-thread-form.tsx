"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { pickUniqueThreadSlug } from "@/lib/forum-slug"
import { getImpersonation } from "@/lib/impersonation"

export function NewThreadForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [impersonation] = useState(() => getImpersonation())

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const t = title.trim()
    const b = body.trim()
    if (!t) {
      setError("Add a title for your post.")
      return
    }
    if (!b) {
      setError("Add a description to start your post.")
      return
    }
    setSubmitting(true)

    if (impersonation) {
      const res = await fetch("/api/admin/impersonate/create-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, body: b }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not create post as this user.")
        setSubmitting(false)
        return
      }
      router.push(`/board-talk/${data.slug}`)
      router.refresh()
      return
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("You must be signed in.")
      setSubmitting(false)
      return
    }

    const slug = await pickUniqueThreadSlug(supabase, t)
    const { data: row, error: insertErr } = await supabase
      .from("forum_threads")
      .insert({
        user_id: user.id,
        title: t,
        slug,
        body: b,
      })
      .select("slug")
      .single()

    if (insertErr || !row) {
      setError(insertErr?.message || "Could not create post. If this persists, confirm forum tables exist (run scripts/032_forum_threads.sql).")
      setSubmitting(false)
      return
    }

    router.push(`/board-talk/${row.slug}`)
    router.refresh()
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="thread-title">Title</Label>
        <Input
          id="thread-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want to talk about?"
          maxLength={200}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thread-body">Description</Label>
        <Textarea
          id="thread-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Kick off your post with context, photos, or a question…"
          className="min-h-[140px] resize-y"
          maxLength={12000}
          required
          aria-required
        />
        <p className="text-xs text-muted-foreground">Required — this is the opening post.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create post"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/board-talk">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
