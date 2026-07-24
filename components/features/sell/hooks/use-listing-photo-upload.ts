"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { ensureBrowserDecodableImageFile } from "@/lib/client-image-decode"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import {
  assertListingOriginalSize,
  prepareListingImagePairFromFile,
} from "@/lib/listing-image-pipeline"
import { uploadListingImagePairToSupabase } from "@/lib/listing-image-storage"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"
import {
  filesFromDataTransfer,
  isOsFileDragEvent,
  isListingPhotoFile,
  listingPhotosUploadReady,
  listingPhotosUploadingCount,
  readyListingPhotoUrls,
  type ListingPhotoSlot,
} from "@/lib/sell-flow/listing-photo-slot"
import { friendlyListingPhotoErrorMessage } from "@/lib/utils/friendly-listing-photo-error"
import { logSellFunnelEvent } from "@/lib/sell-flow/log-sell-funnel-event"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Remembers decoded thumbnails per slot across reorder/remount (dnd-kit). */
export const sellListingThumbLoadedSrcByClientId = new Map<string, string>()

export type UseListingPhotoUploadOptions = {
  maxPhotos?: number
  signInReturnPath: () => string
  openSignIn: (redirect?: string | null) => void
  supabase?: SupabaseClient
  /** Section for sell funnel instrumentation; upload failures are logged when set. */
  funnelListingType?: PeerListingSection
}

export type UseListingPhotoUploadResult = {
  images: ListingPhotoSlot[]
  setImages: Dispatch<SetStateAction<ListingPhotoSlot[]>>
  imagesRef: React.MutableRefObject<ListingPhotoSlot[]>
  removedImageIds: string[]
  setRemovedImageIds: Dispatch<SetStateAction<string[]>>
  photosFileDragActive: boolean
  uploadingCount: number
  imagesUploadReady: boolean
  readyImages: ListingPhotoSlot[]
  addListingPhotoFiles: (incoming: File[]) => void
  handleImageInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handlePhotosFileDragEnter: (e: React.DragEvent) => void
  handlePhotosFileDragLeave: (e: React.DragEvent) => void
  handlePhotosFileDragOver: (e: React.DragEvent) => void
  handlePhotosFileDrop: (e: React.DragEvent) => void
  photoDragSensors: ReturnType<typeof useSensors>
  handlePhotosDragEnd: (event: DragEndEvent) => void
  handlePhotoTileRemove: (clientId: string) => void
  handlePhotoTileRetry: (clientId: string) => void
  handlePhotoTileRotate: (clientId: string) => void
  idbRestoreOptimizeQueueRef: React.MutableRefObject<ListingPhotoSlot[] | null>
  hydrateExistingImages: (slots: ListingPhotoSlot[]) => void
}

export function useListingPhotoUpload({
  maxPhotos = 12,
  signInReturnPath,
  openSignIn,
  supabase: supabaseProp,
  funnelListingType,
}: UseListingPhotoUploadOptions): UseListingPhotoUploadResult {
  const supabaseRef = useRef(supabaseProp ?? createClient())
  const [images, setImages] = useState<ListingPhotoSlot[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [photosFileDragActive, setPhotosFileDragActive] = useState(false)
  const photosFileDragDepthRef = useRef(0)
  const imagesRef = useRef<ListingPhotoSlot[]>([])
  const latestListingPhotoPrepareSeqRef = useRef<Map<string, number>>(new Map())
  const photoUploadSignInPromptedRef = useRef(false)
  const idbRestoreOptimizeQueueRef = useRef<ListingPhotoSlot[] | null>(null)

  imagesRef.current = images

  useEffect(() => {
    return () => {
      for (const im of imagesRef.current) {
        if (im.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(im.previewUrl)
      }
    }
  }, [])

  const listingPhotoPrepareSeqInSync = useCallback((clientId: string, prepareSeq: number): boolean => {
    return (latestListingPhotoPrepareSeqRef.current.get(clientId) ?? 0) === prepareSeq
  }, [])

  const optimizeAndUploadSlot = useCallback(
    async (slot: ListingPhotoSlot) => {
      const supabase = supabaseRef.current
      const clientId = slot.clientId
      const previewUrl = slot.previewUrl
      const prepareSeq = slot.prepareSeq ?? 0
      latestListingPhotoPrepareSeqRef.current.set(clientId, prepareSeq)
      let prepared = slot.prepared

      try {
        if (!prepared) {
          const src = slot.sourceFile
          if (!src) return
          const file = await ensureBrowserDecodableImageFile(src)
          prepared = await prepareListingImagePairFromFile(file, {
            rotate180: Boolean(slot.userRotate180),
          })
          if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
          let nextPreviewUrl = previewUrl
          if (previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl)
          }
          nextPreviewUrl = URL.createObjectURL(prepared.thumb)
          setImages((prev) =>
            prev.map((s) =>
              s.clientId === clientId
                ? {
                    ...s,
                    previewUrl: nextPreviewUrl,
                    optimizePhase: "done",
                    prepared,
                  }
                : s,
            ),
          )
        }

        if (!prepared) return
        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

        let session = await resolveClientSessionForMutation(supabase)
        let user = session?.user ?? null
        if (!session?.access_token || !user) {
          await new Promise((r) => setTimeout(r, 250))
          session = await resolveClientSessionForMutation(supabase)
          user = session?.user ?? null
        }
        if (!session?.access_token || !user) {
          if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
          const authMsg = "Sign in again to upload this photo."
          if (funnelListingType) {
            logSellFunnelEvent({
              listingType: funnelListingType,
              event: "upload_failed",
              message: authMsg,
            })
          }
          setImages((prev) =>
            prev.map((s) =>
              s.clientId === clientId
                ? {
                    ...s,
                    optimizePhase: "done",
                    uploadPhase: "error",
                    errorMessage: authMsg,
                  }
                : s,
            ),
          )
          if (!photoUploadSignInPromptedRef.current) {
            photoUploadSignInPromptedRef.current = true
            toast.error(authMsg)
            openSignIn(signInReturnPath())
          }
          return
        }

        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  uploadPhase: "uploading",
                  progressFull: 0,
                  progressThumb: 0,
                  errorMessage: undefined,
                }
              : s,
          ),
        )

        const { fullUrl, thumbUrl } = await uploadListingImagePairToSupabase({
          supabase,
          userId: user.id,
          clientId,
          prepared,
        })

        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return

        setImages((prev) =>
          prev.map((s) =>
            s.clientId === clientId
              ? {
                  ...s,
                  uploadPhase: "done",
                  url: fullUrl,
                  thumbnailUrl: thumbUrl,
                  progressFull: 100,
                  progressThumb: 100,
                  prepared: undefined,
                  ...(s.dropSourceFileAfterUpload ? { sourceFile: undefined } : {}),
                }
              : s,
          ),
        )
      } catch (e) {
        console.error("[sell] listing photo failed", e)
        const msg = friendlyListingPhotoErrorMessage(e, prepared ? "upload" : "add")
        if (funnelListingType) {
          logSellFunnelEvent({
            listingType: funnelListingType,
            event: "upload_failed",
            message: msg,
          })
        }
        if (!listingPhotoPrepareSeqInSync(clientId, prepareSeq)) return
        setImages((prev) =>
          prev.map((s) => {
            if (s.clientId !== clientId) return s
            if (s.prepared) {
              return { ...s, uploadPhase: "error", errorMessage: msg }
            }
            return {
              ...s,
              optimizePhase: "error",
              uploadPhase: "idle",
              errorMessage: msg,
            }
          }),
        )
        toast.error(msg)
      }
    },
    [listingPhotoPrepareSeqInSync, openSignIn, signInReturnPath, funnelListingType],
  )

  useLayoutEffect(() => {
    const q = idbRestoreOptimizeQueueRef.current
    if (!q?.length) return
    idbRestoreOptimizeQueueRef.current = null
    for (const s of q) void optimizeAndUploadSlot(s)
  }, [optimizeAndUploadSlot])

  useEffect(() => {
    const supabase = supabaseRef.current
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) return
      photoUploadSignInPromptedRef.current = false
      for (const slot of imagesRef.current) {
        if (!slot.sourceFile) continue
        if (slot.uploadPhase === "done") continue
        void optimizeAndUploadSlot(slot)
      }
    })
    return () => subscription.unsubscribe()
  }, [optimizeAndUploadSlot])

  const retryListingPhotoUpload = useCallback(
    (clientId: string) => {
      photoUploadSignInPromptedRef.current = false
      const live = imagesRef.current.find((s) => s.clientId === clientId)
      if (!live) return
      const nextSeq = (live.prepareSeq ?? 0) + 1
      latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
      const next: ListingPhotoSlot = {
        ...live,
        prepareSeq: nextSeq,
        errorMessage: undefined,
      }
      setImages((prev) => prev.map((s) => (s.clientId === clientId ? next : s)))
      void optimizeAndUploadSlot(next)
    },
    [optimizeAndUploadSlot],
  )

  const rotateListingPhoto180 = useCallback(
    (clientId: string) => {
      const live = imagesRef.current.find((s) => s.clientId === clientId)
      if (!live) return
      if (live.optimizePhase === "error" || live.uploadPhase === "error") return
      if (live.optimizePhase === "running") return

      if (live.sourceFile) {
        let nextSlot: ListingPhotoSlot | null = null
        setImages((prev) =>
          prev.map((s) => {
            if (s.clientId !== clientId) return s
            const src = s.sourceFile
            if (!src) return s
            if (s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl)
            sellListingThumbLoadedSrcByClientId.delete(s.clientId)
            const nextSeq = (s.prepareSeq ?? 0) + 1
            latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
            nextSlot = {
              ...s,
              userRotate180: !s.userRotate180,
              prepareSeq: nextSeq,
              prepared: undefined,
              optimizePhase: "running",
              uploadPhase: "idle",
              url: undefined,
              thumbnailUrl: undefined,
              progressFull: 0,
              progressThumb: 0,
              previewUrl: URL.createObjectURL(src),
              errorMessage: undefined,
            }
            return nextSlot
          }),
        )
        if (nextSlot) void optimizeAndUploadSlot(nextSlot)
        return
      }

      const fullUrl = (live.url ?? "").trim()
      if (!fullUrl || live.uploadPhase !== "done") return

      const snapshot: ListingPhotoSlot = { ...live }

      setImages((prev) =>
        prev.map((s) =>
          s.clientId === clientId
            ? { ...s, optimizePhase: "running", errorMessage: undefined }
            : s,
        ),
      )

      void (async () => {
        try {
          const res = await fetch(proxiedListingImageSrc(fullUrl))
          if (!res.ok) {
            throw new Error("Could not load this photo to rotate it.")
          }
          const blob = await res.blob()
          const file = new File(
            [blob],
            "listing-photo.jpg",
            { type: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg" },
          )

          let nextSlot: ListingPhotoSlot | null = null
          setImages((prev) =>
            prev.map((s) => {
              if (s.clientId !== clientId) return s
              if (s.previewUrl.startsWith("blob:")) URL.revokeObjectURL(s.previewUrl)
              sellListingThumbLoadedSrcByClientId.delete(s.clientId)
              const nextSeq = (s.prepareSeq ?? 0) + 1
              latestListingPhotoPrepareSeqRef.current.set(clientId, nextSeq)
              nextSlot = {
                ...s,
                userRotate180: !s.userRotate180,
                prepareSeq: nextSeq,
                prepared: undefined,
                optimizePhase: "running",
                uploadPhase: "idle",
                url: undefined,
                thumbnailUrl: undefined,
                progressFull: 0,
                progressThumb: 0,
                previewUrl: URL.createObjectURL(file),
                sourceFile: file,
                dropSourceFileAfterUpload: true,
                errorMessage: undefined,
              }
              return nextSlot
            }),
          )
          if (nextSlot) void optimizeAndUploadSlot(nextSlot)
        } catch (e) {
          toast.error(friendlyListingPhotoErrorMessage(e, "rotate"))
          setImages((prev) => prev.map((s) => (s.clientId === clientId ? snapshot : s)))
        }
      })()
    },
    [optimizeAndUploadSlot],
  )

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const toRemove = prev[index]
      if (toRemove?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      if (toRemove?.clientId) {
        sellListingThumbLoadedSrcByClientId.delete(toRemove.clientId)
        latestListingPhotoPrepareSeqRef.current.delete(toRemove.clientId)
      }
      if (toRemove?.id) {
        setRemovedImageIds((ids) => [...ids, toRemove.id!])
      }
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const photoTileActionsRef = useRef({
    remove: (_clientId: string) => {},
    retry: (_clientId: string) => {},
    rotate: (_clientId: string) => {},
  })
  photoTileActionsRef.current.remove = (clientId: string) => {
    const idx = imagesRef.current.findIndex((s) => s.clientId === clientId)
    if (idx >= 0) removeImage(idx)
  }
  photoTileActionsRef.current.retry = retryListingPhotoUpload
  photoTileActionsRef.current.rotate = rotateListingPhoto180

  const handlePhotoTileRemove = useCallback(
    (clientId: string) => photoTileActionsRef.current.remove(clientId),
    [],
  )
  const handlePhotoTileRetry = useCallback(
    (clientId: string) => photoTileActionsRef.current.retry(clientId),
    [],
  )
  const handlePhotoTileRotate = useCallback(
    (clientId: string) => photoTileActionsRef.current.rotate(clientId),
    [],
  )

  const addListingPhotoFiles = useCallback(
    (incoming: File[]) => {
      const imageFiles = incoming.filter(isListingPhotoFile)
      if (!imageFiles.length) {
        toast.error("Drop one or more image files (JPEG, PNG, HEIC, etc.).")
        return
      }

      const currentCount = imagesRef.current.length
      if (currentCount >= maxPhotos) {
        toast.error(`Maximum ${maxPhotos} photos allowed.`)
        return
      }

      const room = maxPhotos - currentCount
      const toAdd = imageFiles.slice(0, room)
      if (imageFiles.length > room) {
        toast.error(
          `Only ${room} more photo${room === 1 ? "" : "s"} can be added (${maxPhotos} max).`,
        )
      }

      const newSlots: ListingPhotoSlot[] = []
      for (const originalFile of toAdd) {
        try {
          assertListingOriginalSize(originalFile)
        } catch (err) {
          toast.error(friendlyListingPhotoErrorMessage(err))
          continue
        }
        newSlots.push({
          clientId: crypto.randomUUID(),
          previewUrl: URL.createObjectURL(originalFile),
          optimizePhase: "running",
          uploadPhase: "idle",
          progressFull: 0,
          progressThumb: 0,
          sourceFile: originalFile,
        })
      }

      if (!newSlots.length) return

      setImages((prev) => [...prev, ...newSlots])
      for (const slot of newSlots) void optimizeAndUploadSlot(slot)
    },
    [maxPhotos, optimizeAndUploadSlot],
  )

  const handleImageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return
      addListingPhotoFiles(Array.from(e.target.files))
      e.target.value = ""
    },
    [addListingPhotoFiles],
  )

  const handlePhotosFileDragEnter = useCallback((e: React.DragEvent) => {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    photosFileDragDepthRef.current += 1
    setPhotosFileDragActive(true)
  }, [])

  const handlePhotosFileDragLeave = useCallback((e: React.DragEvent) => {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    photosFileDragDepthRef.current -= 1
    if (photosFileDragDepthRef.current <= 0) {
      photosFileDragDepthRef.current = 0
      setPhotosFileDragActive(false)
    }
  }, [])

  const handlePhotosFileDragOver = useCallback((e: React.DragEvent) => {
    if (!isOsFileDragEvent(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const handlePhotosFileDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isOsFileDragEvent(e)) return
      e.preventDefault()
      e.stopPropagation()
      photosFileDragDepthRef.current = 0
      setPhotosFileDragActive(false)
      addListingPhotoFiles(filesFromDataTransfer(e.dataTransfer))
    },
    [addListingPhotoFiles],
  )

  // Whole-tile drag: press-and-hold on touch so a normal swipe still scrolls the page.
  const photoDragSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handlePhotosDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setImages((prev) => {
      const oldIndex = prev.findIndex((i) => i.clientId === active.id)
      const newIndex = prev.findIndex((i) => i.clientId === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  const hydrateExistingImages = useCallback((slots: ListingPhotoSlot[]) => {
    sellListingThumbLoadedSrcByClientId.clear()
    latestListingPhotoPrepareSeqRef.current.clear()
    setImages(slots)
    setRemovedImageIds([])
  }, [])

  return {
    images,
    setImages,
    imagesRef,
    removedImageIds,
    setRemovedImageIds,
    photosFileDragActive,
    uploadingCount: listingPhotosUploadingCount(images),
    imagesUploadReady: listingPhotosUploadReady(images),
    readyImages: readyListingPhotoUrls(images),
    addListingPhotoFiles,
    handleImageInputChange,
    handlePhotosFileDragEnter,
    handlePhotosFileDragLeave,
    handlePhotosFileDragOver,
    handlePhotosFileDrop,
    photoDragSensors,
    handlePhotosDragEnd,
    handlePhotoTileRemove,
    handlePhotoTileRetry,
    handlePhotoTileRotate,
    idbRestoreOptimizeQueueRef,
    hydrateExistingImages,
  }
}
