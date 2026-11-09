"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { uploadMessageMediaFile } from "@/lib/message-media-upload-client"
import {
  MESSAGE_MEDIA_ACCEPT,
  assertAcceptedMessageMediaFile,
  isAcceptedMessageVideoFile,
} from "@/lib/message-media-pipeline"
import { discardConversationMediaUpload } from "@/app/actions/messages"
import { getPolicyBlockFromSendResult } from "@/lib/messages/policy-block-client"
import { PENDING_THREAD_MESSAGE_ID_PREFIX } from "@/lib/messages/local-phone-policy-block-message"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { PromiseDeadlineError, raceWithDeadline } from "@/lib/utils/race-with-deadline"
import { friendlyMessageMediaErrorMessage } from "@/lib/utils/friendly-message-media-error"
import { isAbortError } from "@/lib/utils/is-abort-error"
import {
  composeMediaAttachmentMessageBody,
  type MarketplaceMessageAttachment,
} from "@/lib/validations/marketplace-message-attachment"
import {
  MessageMediaDraftPreview,
  type MessageMediaDraft,
} from "@/components/features/messages/message-media-draft-preview"

const MEDIA_SEND_SERVER_ACTION_MS = 45_000

async function postConversationMediaReply(body: {
  conversation_id: string
  attachment: Omit<MarketplaceMessageAttachment, "bucket">
  caption?: string
  composer_unlock_token: string
}): Promise<unknown> {
  const res = await fetch("/api/messages/send-media", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    keepalive: true,
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json().catch(() => null)
  if (json && typeof json === "object") return json
  return { error: "Could not send message" as const }
}

type SentMediaMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  is_read: boolean
  metadata: { attachment: MarketplaceMessageAttachment }
}

type ActiveJob = {
  draftId: string
  file: File
  conversationId: string
  caption?: string
  abort: AbortController
  uploadedPath: string | null
}

function overallProgress(phase: MessageMediaDraft["phase"], prepareRatio: number, uploadRatio: number): number {
  if (phase === "preparing") return Math.round(prepareRatio * 35)
  if (phase === "uploading") return Math.round(35 + uploadRatio * 55)
  if (phase === "sending") return 95
  return 0
}

export type OptimisticMediaDraft = {
  id: string
  kind: "image" | "video"
  previewUrl: string
  fileName: string
  caption: string
  content: string
}

export function MessageMediaSendButton({
  conversationId,
  disabled,
  caption,
  onSent,
  onBlockedPolicy,
  className,
  ensureConversationId,
  onDraftUiChange,
  composerUnlockToken,
  onOptimistic,
  onProgress,
  onFailed,
  onDismiss,
  registerRetry,
}: {
  conversationId: string | null
  disabled?: boolean
  caption?: string
  composerUnlockToken?: string | null
  onSent: (message: SentMediaMessage, draftId: string) => void
  onBlockedPolicy?: (
    originalContent: string,
    reasonCode: MessagePolicyReasonCode,
    draftId?: string,
  ) => void
  className?: string
  /** Creates the conversation on demand when media is the first message. */
  ensureConversationId?: () => Promise<string | null>
  /** Renders the draft preview outside the icon button (composer column). */
  onDraftUiChange?: (node: ReactNode) => void
  /** Put the photo in the thread immediately (iMessage-style). */
  onOptimistic?: (draft: OptimisticMediaDraft) => void
  onProgress?: (draftId: string, progress: number) => void
  onFailed?: (draftId: string) => void
  /** Drop a previous optimistic bubble when the user picks a different file. */
  onDismiss?: (draftId: string) => void
  registerRetry?: (retry: (draftId: string) => void) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const composerUnlockTokenRef = useRef(composerUnlockToken)
  composerUnlockTokenRef.current = composerUnlockToken
  const supabase = createClient()
  const supabaseProjectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

  const [draft, setDraft] = useState<MessageMediaDraft | null>(null)
  const jobRef = useRef<ActiveJob | null>(null)
  const draftRef = useRef<MessageMediaDraft | null>(null)
  draftRef.current = draft

  const clearDraftPreviewUrl = useCallback((previewUrl: string | undefined) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
  }, [])

  const discardUploadedPath = useCallback(
    async (targetConversationId: string, path: string | null | undefined) => {
      if (!path) return
      try {
        await discardConversationMediaUpload({
          conversation_id: targetConversationId,
          path,
        })
      } catch {
        /* best-effort */
      }
    },
    [],
  )

  const resetJob = useCallback(
    async (opts?: { discardUpload?: boolean }) => {
      const job = jobRef.current
      jobRef.current = null
      if (job) {
        job.abort.abort()
        if (opts?.discardUpload) {
          await discardUploadedPath(job.conversationId, job.uploadedPath)
        }
      }
      setDraft((prev) => {
        clearDraftPreviewUrl(prev?.previewUrl)
        return null
      })
    },
    [clearDraftPreviewUrl, discardUploadedPath],
  )

  const runSendPipeline = useCallback(
    async (job: ActiveJob) => {
      const { draftId, file, abort } = job
      const signal = abort.signal

      const patchDraft = (patch: Partial<MessageMediaDraft>) => {
        if (typeof patch.progress === "number") onProgress?.(draftId, patch.progress)
        setDraft((prev) => {
          if (!prev || prev.id !== draftId) return prev
          return { ...prev, ...patch }
        })
      }

      try {
        patchDraft({
          phase: "preparing",
          progress: 5,
          errorMessage: undefined,
        })

        const session = await resolveClientSessionForMutation(supabase)
        if (!session?.access_token) {
          throw new Error("Sign in again to send photos and videos.")
        }
        if (signal.aborted) return

        const uploaded = await uploadMessageMediaFile({
          file,
          conversationId: job.conversationId,
          supabaseUrl: supabaseProjectUrl,
          accessToken: session.access_token,
          anonKey: supabaseAnonKey,
          signal,
          onPrepareProgress: (ratio) => {
            patchDraft({
              phase: "preparing",
              progress: overallProgress("preparing", ratio, 0),
            })
          },
          onProgress: (loaded, total) => {
            const uploadRatio = total > 0 ? loaded / total : 0
            patchDraft({
              phase: "uploading",
              progress: overallProgress("uploading", 1, uploadRatio),
            })
          },
        })

        if (signal.aborted) {
          await discardUploadedPath(job.conversationId, uploaded.attachment.path)
          return
        }

        job.uploadedPath = uploaded.attachment.path
        patchDraft({ phase: "sending", progress: 95 })

        const result = await raceWithDeadline(
          postConversationMediaReply({
            conversation_id: job.conversationId,
            attachment: uploaded.attachment,
            caption: job.caption,
            composer_unlock_token: composerUnlockTokenRef.current ?? "",
          }),
          MEDIA_SEND_SERVER_ACTION_MS,
        )

        if (signal.aborted) {
          // Send may have succeeded; do not delete — user can refresh thread.
          return
        }

        if ("error" in result) {
          const policyReason = getPolicyBlockFromSendResult(result)
          if (policyReason) {
            // Server already deleted the orphan on policy block.
            job.uploadedPath = null
            jobRef.current = null
            setDraft((prev) => {
              clearDraftPreviewUrl(prev?.previewUrl)
              return null
            })
            onBlockedPolicy?.(job.caption?.trim() || "", policyReason, draftId)
            return
          }

          // Server cleans up on most failures; clear local path so cancel doesn't double-delete.
          job.uploadedPath = null
          const message =
            typeof result.error === "string"
              ? friendlyMessageMediaErrorMessage(result.error)
              : "Couldn't send this. Tap Retry."
          patchDraft({
            phase: "error",
            progress: 0,
            errorMessage: message || "Couldn't send this. Tap Retry.",
          })
          onFailed?.(draftId)
          return
        }

        job.uploadedPath = null
        jobRef.current = null
        onSent(result.message as SentMediaMessage, draftId)
        setDraft((prev) => {
          const url = prev?.previewUrl
          if (url) window.setTimeout(() => clearDraftPreviewUrl(url), 1500)
          return null
        })
      } catch (error) {
        if (isAbortError(error) || signal.aborted) {
          return
        }

        // Timeout: the server action may still succeed — never delete the object.
        if (error instanceof PromiseDeadlineError) {
          job.uploadedPath = null
          patchDraft({
            phase: "error",
            progress: 0,
            errorMessage: friendlyMessageMediaErrorMessage(error),
          })
          onFailed?.(draftId)
          return
        }

        if (job.uploadedPath) {
          await discardUploadedPath(job.conversationId, job.uploadedPath)
          job.uploadedPath = null
        }

        const friendly = friendlyMessageMediaErrorMessage(error)
        patchDraft({
          phase: "error",
          progress: 0,
          errorMessage: friendly || "Couldn't send this. Tap Retry.",
        })
        onFailed?.(draftId)
      }
    },
    [
      clearDraftPreviewUrl,
      discardUploadedPath,
      onBlockedPolicy,
      onFailed,
      onProgress,
      onSent,
      supabase,
      supabaseAnonKey,
      supabaseProjectUrl,
    ],
  )

  const startWithFile = useCallback(
    async (file: File) => {
      try {
        assertAcceptedMessageMediaFile(file)
      } catch (error) {
        toast.error(friendlyMessageMediaErrorMessage(error))
        return
      }

      const previousDraftId = draftRef.current?.id
      if (previousDraftId) onDismiss?.(previousDraftId)
      await resetJob({ discardUpload: true })

      let targetConversationId = conversationId
      if (!targetConversationId && ensureConversationId) {
        targetConversationId = await ensureConversationId()
      }
      if (!targetConversationId) {
        toast.error("Could not start the conversation. Try sending a message first.")
        return
      }

      const draftId = `${PENDING_THREAD_MESSAGE_ID_PREFIX}${crypto.randomUUID()}`
      const previewUrl = URL.createObjectURL(file)
      const kind = isAcceptedMessageVideoFile(file) ? "video" : "image"
      const nextDraft: MessageMediaDraft = {
        id: draftId,
        kind,
        previewUrl,
        fileName: file.name || (kind === "video" ? "Video" : "Photo"),
        phase: "preparing",
        progress: 0,
      }

      const job: ActiveJob = {
        draftId,
        file,
        conversationId: targetConversationId,
        caption: caption?.trim() || undefined,
        abort: new AbortController(),
        uploadedPath: null,
      }
      jobRef.current = job
      setDraft(nextDraft)
      const captionText = caption?.trim() || ""
      onOptimistic?.({
        id: draftId,
        kind,
        previewUrl,
        fileName: nextDraft.fileName,
        caption: captionText,
        content: captionText || composeMediaAttachmentMessageBody(kind),
      })
      void runSendPipeline(job)
    },
    [caption, conversationId, ensureConversationId, onDismiss, onOptimistic, resetJob, runSendPipeline],
  )

  const handleCancel = useCallback(() => {
    const phase = draftRef.current?.phase
    // If the server action is already in flight, leave the object — delete could
    // race a successful insert and break the message that still lands via realtime.
    void resetJob({ discardUpload: phase !== "sending" })
  }, [resetJob])

  const handleRetry = useCallback(() => {
    const job = jobRef.current
    const current = draftRef.current
    if (!current) return

    const file = job?.file
    if (!file) {
      void resetJob()
      return
    }

    const conversationForRetry = job?.conversationId ?? conversationId
    if (!conversationForRetry) {
      toast.error("Could not start the conversation. Try sending a message first.")
      return
    }

    // Drop any prior orphan, then reuse the same local preview.
    if (job?.uploadedPath) {
      void discardUploadedPath(job.conversationId, job.uploadedPath)
    }
    job?.abort.abort()

    const nextJob: ActiveJob = {
      draftId: current.id,
      file,
      conversationId: conversationForRetry,
      caption: job?.caption ?? (caption?.trim() || undefined),
      abort: new AbortController(),
      uploadedPath: null,
    }
    jobRef.current = nextJob
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            phase: "preparing",
            progress: 5,
            errorMessage: undefined,
          }
        : prev,
    )
    onProgress?.(current.id, 5)
    void runSendPipeline(nextJob)
  }, [caption, conversationId, discardUploadedPath, onProgress, resetJob, runSendPipeline])

  const handleCancelRef = useRef(handleCancel)
  handleCancelRef.current = handleCancel
  const handleRetryRef = useRef(handleRetry)
  handleRetryRef.current = handleRetry

  useEffect(() => {
    if (onOptimistic) return
    if (!onDraftUiChange) return
    onDraftUiChange(
      draft ? (
        <MessageMediaDraftPreview
          draft={draft}
          onCancel={() => handleCancelRef.current()}
          onRetry={() => handleRetryRef.current()}
        />
      ) : null,
    )
    return () => onDraftUiChange(null)
  }, [draft, onDraftUiChange, onOptimistic])

  useEffect(() => {
    registerRetry?.((draftId) => {
      if (draftRef.current?.id !== draftId) return
      handleRetryRef.current()
    })
  }, [registerRetry])

  useEffect(() => {
    return () => {
      // Leave the upload running so leaving the thread does not cancel the send.
      jobRef.current = null
    }
  }, [])

  const busy = !!draft && draft.phase !== "error"

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length || busy || disabled) return
    const file = files[0]
    if (!file) return
    await startWithFile(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  const trigger = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={MESSAGE_MEDIA_ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => {
          void handleFilesSelected(e.target.files)
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || busy}
        className={cn(
          "h-8 w-8 shrink-0 rounded-full bg-[#E9E9EB] text-foreground shadow-none hover:bg-[#dedee0] dark:bg-[#3A3A3C] dark:hover:bg-[#4a4a4c]",
          className,
        )}
        aria-label="Send photo or video"
        onClick={() => inputRef.current?.click()}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </Button>
    </>
  )

  // Parent hosts the filename card, or the thread shows the photo bubble.
  if (onDraftUiChange || onOptimistic) {
    return trigger
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      {draft ? (
        <MessageMediaDraftPreview
          draft={draft}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      ) : null}
      {trigger}
    </div>
  )
}
