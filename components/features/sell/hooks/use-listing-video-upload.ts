"use client"

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import {
  assertAcceptedListingVideoFile,
  assertListingVideoDuration,
  assertListingVideoOriginalSize,
  captureListingVideoPosterBlob,
  isAcceptedListingVideoFile,
  LISTING_VIDEO_MAX_COUNT,
} from "@/lib/listing-video-pipeline"
import { uploadListingVideoToSupabase } from "@/lib/listing-video-storage"
import {
  createEmptyListingVideoSlot,
  listingVideoUploadReady,
  readyListingVideoPayload,
  type ListingVideoSlot,
} from "@/lib/sell-flow/listing-video-slot"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

export type UseListingVideoUploadOptions = {
  signInReturnPath: () => string
  openSignIn: (redirect?: string | null) => void
  supabase?: SupabaseClient
  persistBeforeSignIn?: () => void | Promise<void>
  promptSignInOnUpload?: boolean
}

export type UseListingVideoUploadResult = {
  video: ListingVideoSlot | null
  setVideo: Dispatch<SetStateAction<ListingVideoSlot | null>>
  removedVideoIds: string[]
  setRemovedVideoIds: Dispatch<SetStateAction<string[]>>
  videoUploadReady: boolean
  videoUploading: boolean
  readyVideo: ReturnType<typeof readyListingVideoPayload>
  handleVideoInputChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleVideoRemove: () => void
  handleVideoRetry: () => void
  hydrateExistingVideo: (slot: ListingVideoSlot | null) => void
}

function friendlyVideoError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message
  return "Couldn't upload that video. Try again with an MP4 or MOV under 200MB."
}

export function useListingVideoUpload({
  signInReturnPath,
  openSignIn,
  supabase: supabaseProp,
  persistBeforeSignIn,
  promptSignInOnUpload = true,
}: UseListingVideoUploadOptions): UseListingVideoUploadResult {
  const [video, setVideo] = useState<ListingVideoSlot | null>(null)
  const [removedVideoIds, setRemovedVideoIds] = useState<string[]>([])
  const videoRef = useRef<ListingVideoSlot | null>(null)
  videoRef.current = video

  const getSupabase = useCallback(
    () => supabaseProp ?? createClient(),
    [supabaseProp],
  )

  const revokePreview = useCallback((slot: ListingVideoSlot | null) => {
    if (slot?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(slot.previewUrl)
    }
  }, [])

  const hydrateExistingVideo = useCallback(
    (slot: ListingVideoSlot | null) => {
      revokePreview(videoRef.current)
      setVideo(slot)
      setRemovedVideoIds([])
    },
    [revokePreview],
  )

  const uploadSlot = useCallback(
    async (slot: ListingVideoSlot) => {
      const file = slot.file
      if (!file) return

      setVideo((prev) =>
        prev && prev.clientId === slot.clientId
          ? { ...prev, status: "uploading", errorMessage: null, uploadProgress: 0.05 }
          : prev,
      )

      try {
        assertAcceptedListingVideoFile(file)
        assertListingVideoOriginalSize(file)
        const durationSeconds = await assertListingVideoDuration(file)
        const poster = await captureListingVideoPosterBlob(file)

        const supabase = getSupabase()
        const session = await resolveClientSessionForMutation(supabase)
        if (!session?.user) {
          throw new Error("Sign in again to upload this video.")
        }

        const uploaded = await uploadListingVideoToSupabase({
          supabase,
          clientId: slot.clientId,
          file,
          durationSeconds,
          poster,
        })

        setVideo((prev) => {
          if (!prev || prev.clientId !== slot.clientId) return prev
          if (prev.previewUrl?.startsWith("blob:")) {
            URL.revokeObjectURL(prev.previewUrl)
          }
          return {
            ...prev,
            status: "ready",
            url: uploaded.url,
            thumbnailUrl: uploaded.thumbnailUrl,
            contentType: uploaded.contentType,
            durationSeconds: uploaded.durationSeconds,
            byteSize: uploaded.byteSize,
            previewUrl: uploaded.thumbnailUrl ?? uploaded.url,
            file: null,
            uploadProgress: 1,
            errorMessage: null,
          }
        })
      } catch (err) {
        const message = friendlyVideoError(err)
        setVideo((prev) =>
          prev && prev.clientId === slot.clientId
            ? { ...prev, status: "error", errorMessage: message, uploadProgress: null }
            : prev,
        )
        toast.error(message)
      }
    },
    [getSupabase],
  )

  const beginUploadForFile = useCallback(
    async (file: File) => {
      if (!isAcceptedListingVideoFile(file)) {
        toast.error("That video type isn't supported. Try an MP4, MOV, or WebM file.")
        return
      }

      const supabase = getSupabase()
      const session = await resolveClientSessionForMutation(supabase)
      if (!session?.user) {
        if (promptSignInOnUpload) {
          try {
            await persistBeforeSignIn?.()
          } catch {
            /* best-effort */
          }
          openSignIn(signInReturnPath())
          return
        }
        revokePreview(videoRef.current)
        const previewUrl = URL.createObjectURL(file)
        setVideo(
          createEmptyListingVideoSlot({
            status: "pending_auth",
            file,
            previewUrl,
            byteSize: file.size,
          }),
        )
        return
      }

      if (videoRef.current?.id) {
        setRemovedVideoIds((ids) =>
          ids.includes(videoRef.current!.id!) ? ids : [...ids, videoRef.current!.id!],
        )
      }
      revokePreview(videoRef.current)

      const clientId = crypto.randomUUID()
      const previewUrl = URL.createObjectURL(file)
      const next = createEmptyListingVideoSlot({
        clientId,
        status: "uploading",
        file,
        previewUrl,
        byteSize: file.size,
        uploadProgress: 0,
      })
      setVideo(next)
      void uploadSlot(next)
    },
    [
      getSupabase,
      openSignIn,
      persistBeforeSignIn,
      promptSignInOnUpload,
      revokePreview,
      signInReturnPath,
      uploadSlot,
    ],
  )

  const handleVideoInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file) return
      if (LISTING_VIDEO_MAX_COUNT < 1) return
      void beginUploadForFile(file)
    },
    [beginUploadForFile],
  )

  const handleVideoRemove = useCallback(() => {
    const current = videoRef.current
    if (current?.id) {
      setRemovedVideoIds((ids) => (ids.includes(current.id!) ? ids : [...ids, current.id!]))
    }
    revokePreview(current)
    setVideo(null)
  }, [revokePreview])

  const handleVideoRetry = useCallback(() => {
    const current = videoRef.current
    if (!current?.file) return
    void uploadSlot({ ...current, status: "uploading", errorMessage: null })
  }, [uploadSlot])

  return {
    video,
    setVideo,
    removedVideoIds,
    setRemovedVideoIds,
    videoUploadReady: listingVideoUploadReady(video),
    videoUploading: video?.status === "uploading",
    readyVideo: readyListingVideoPayload(video),
    handleVideoInputChange,
    handleVideoRemove,
    handleVideoRetry,
    hydrateExistingVideo,
  }
}
