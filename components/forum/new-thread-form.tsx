"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { pickUniqueThreadSlug } from "@/lib/forum-slug"
import { getImpersonation } from "@/lib/impersonation"
import { uploadForumCommentMediaFile } from "@/lib/forum-comment-media-upload-client"
import { sendForumCommentMediaReply } from "@/app/actions/forum"
import { ForumPhotoPicker } from "@/components/features/forum/forum-photo-picker"
import { threadsDestructiveClassName } from "@/components/features/forum/threads-brand-styles"
import { cn } from "@/lib/utils"

export function NewThreadForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [impersonation, setImpersonation] = useState(() => getImpersonation())
  useEffect(() => { setImpersonation(getImpersonation()) }, [])

  function handlePhotoSelected(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only photos are supported.")
      return
    }
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(file)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  function clearPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
  }

  async function uploadOpeningPhoto(threadId: string, threadSlug: string, caption: string) {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      throw new Error("Sign in again to add photos.")
    }

    const uploaded = await uploadForumCommentMediaFile({
      file: photoFile!,
      threadId,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      accessToken: session.access_token,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    })

    const result = await sendForumCommentMediaReply({
      thread_id: threadId,
      thread_slug: threadSlug,
      attachment: uploaded.attachment,
      caption: caption || undefined,
      opening_post: true,
    })

    if ("error" in result) {
      throw new Error(result.error)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const t = title.trim()
    const b = body.trim()
    if (!t) {
      setError("Add a title for your post.")
      return
    }
    if (!b && !photoFile) {
      setError("Add a description or attach a photo to start your post.")
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
      router.push(`/threads/${data.slug}`)
      router.refresh()
      onCreated?.()
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
      .select("id, slug")
      .single()

    if (insertErr || !row) {
      setError(insertErr?.message || "Could not create post. If this persists, confirm forum tables exist (run scripts/032_forum_threads.sql).")
      setSubmitting(false)
      return
    }

    if (photoFile) {
      try {
        await uploadOpeningPhoto(row.id, row.slug, b)
      } catch (photoError) {
        toast.error(
          photoError instanceof Error
            ? photoError.message
            : "Thread created, but the photo could not be uploaded.",
        )
      }
    }

    router.push(`/threads/${row.slug}`)
    router.refresh()
    onCreated?.()
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
          placeholder="Kick off your post with context, a question, or a caption for your photo…"
          className="min-h-[140px] resize-y"
          maxLength={12000}
          aria-required={!photoFile}
        />
        <p className="text-xs text-muted-foreground">
          {photoFile ? "Optional caption for your photo." : "Required unless you attach a photo."}
        </p>
      </div>
      <ForumPhotoPicker
        previewUrl={photoPreviewUrl}
        disabled={submitting}
        onSelect={handlePhotoSelected}
        onClear={clearPhoto}
      />
      {error && <p className={cn("text-sm", threadsDestructiveClassName)}>{error}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create post"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/threads">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
