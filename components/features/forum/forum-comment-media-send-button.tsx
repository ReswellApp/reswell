"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { uploadForumCommentMediaFile } from "@/lib/forum-comment-media-upload-client"
import { sendForumCommentMediaReply } from "@/app/actions/forum"
import { raceWithDeadline } from "@/lib/utils/race-with-deadline"
import type { SentForumCommentMedia } from "@/lib/validations/forum-comment-attachment"

export function ForumCommentMediaSendButton({
  threadId,
  threadSlug,
  parentId = null,
  disabled,
  caption,
  onSent,
  className,
}: {
  threadId: string
  threadSlug: string
  parentId?: string | null
  disabled?: boolean
  caption?: string
  onSent: (comment: SentForumCommentMedia) => void
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || uploading || disabled) return

    const file = files[0]
    if (!file) return

    setUploading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error("Sign in again to add photos.")
        return
      }

      const uploaded = await uploadForumCommentMediaFile({
        file,
        threadId,
        supabaseUrl: supabaseProjectUrl,
        accessToken: session.access_token,
        anonKey: supabaseAnonKey,
      })

      const result = await raceWithDeadline(
        sendForumCommentMediaReply({
          thread_id: threadId,
          thread_slug: threadSlug,
          attachment: uploaded.attachment,
          caption: caption?.trim() || undefined,
          parent_id: parentId,
        }),
        MEDIA_SEND_SERVER_ACTION_MS,
      )

      if ("error" in result) {
        toast.error(result.error)
        return
      }

      onSent(result.comment as SentForumCommentMedia)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload photo")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => {
          void handleFilesSelected(e.target.files)
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || uploading}
        className={cn("h-10 w-10 shrink-0 rounded-full text-muted-foreground", className)}
        aria-label="Add photo"
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <ImagePlus className="h-5 w-5" strokeWidth={2} aria-hidden />
        )}
      </Button>
    </>
  )
}
