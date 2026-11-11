import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import { uploadSellPhoto, uploadSellVideoIfNeeded } from "@/lib/api"
import { sellPhotoHasStorageUrls, type SellDraft, type SellPhoto, type SellVideo } from "@/lib/sell-flow"

/**
 * Uploads listing photos and video while the seller is still filling the form,
 * so Post is a publish request instead of a storage wait.
 */
export function useSellMediaUpload(
  accessToken: string | null | undefined,
  photos: SellPhoto[],
  video: SellVideo | null,
  setDraft: Dispatch<SetStateAction<SellDraft>>,
): {
  flushPendingUploads: (accessToken?: string) => Promise<void>
  mergeUploadedMedia: (draft: SellDraft) => SellDraft
} {
  const tokenRef = useRef(accessToken)
  tokenRef.current = accessToken
  const photosRef = useRef(photos)
  photosRef.current = photos
  const videoRef = useRef(video)
  videoRef.current = video
  const photoUrls = useRef(new Map<string, { uri: string; url: string; thumbnailUrl: string }>())
  const videoStored = useRef<SellVideo | null>(null)
  const chain = useRef(Promise.resolve())

  const mergePhoto = useCallback((photo: SellPhoto): SellPhoto => {
    const stored = photoUrls.current.get(photo.id)
    if (stored && stored.uri === photo.uri) {
      return { ...photo, url: stored.url, thumbnailUrl: stored.thumbnailUrl }
    }
    return photo
  }, [])

  const mergeUploadedMedia = useCallback(
    (draft: SellDraft): SellDraft => {
      const clip = draft.video
      const storedClip = videoStored.current
      const nextVideo =
        clip && storedClip && storedClip.id === clip.id && storedClip.uri === clip.uri ? storedClip : clip
      return { ...draft, photos: draft.photos.map(mergePhoto), video: nextVideo }
    },
    [mergePhoto],
  )

  const uploadMissing = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return

    for (const photo of photosRef.current) {
      const merged = mergePhoto(photo)
      if (sellPhotoHasStorageUrls(merged)) continue
      try {
        const stored = await uploadSellPhoto(token, photo.uri)
        if (!photosRef.current.some((item) => item.id === photo.id && item.uri === photo.uri)) continue
        photoUrls.current.set(photo.id, {
          uri: photo.uri,
          url: stored.url,
          thumbnailUrl: stored.thumbnail_url,
        })
        setDraft((current) => ({
          ...current,
          photos: current.photos.map((item) =>
            item.id === photo.id && item.uri === photo.uri
              ? { ...item, url: stored.url, thumbnailUrl: stored.thumbnail_url }
              : item,
          ),
        }))
      } catch {
        // Publish/save retries via uploadSellMedia.
      }
    }

    const clip = videoRef.current
    if (!clip || clip.url || clip.status === "error") return
    if (videoStored.current?.id === clip.id && videoStored.current.uri === clip.uri && videoStored.current.url) {
      return
    }
    if (clip.status === "uploading") return
    setDraft((current) =>
      current.video && current.video.id === clip.id && !current.video.url
        ? { ...current, video: { ...current.video, status: "uploading", errorMessage: null } }
        : current,
    )
    try {
      const stored = await uploadSellVideoIfNeeded(token, clip, (ratio) => {
        setDraft((current) =>
          current.video && current.video.id === clip.id
            ? { ...current, video: { ...current.video, status: "uploading", uploadProgress: ratio } }
            : current,
        )
      })
      if (!stored) return
      videoStored.current = stored
      setDraft((current) =>
        current.video && current.video.id === clip.id && current.video.uri === clip.uri
          ? { ...current, video: stored }
          : current,
      )
    } catch {
      setDraft((current) =>
        current.video && current.video.id === clip.id && !current.video.url
          ? {
              ...current,
              video: {
                ...current.video,
                status: "error",
                errorMessage: "Couldn't upload that video",
              },
            }
          : current,
      )
    }
  }, [mergePhoto, setDraft])

  const enqueue = useCallback(() => {
    chain.current = chain.current.then(uploadMissing, uploadMissing)
  }, [uploadMissing])

  useEffect(() => {
    enqueue()
  }, [accessToken, enqueue, photos, video])

  const flushPendingUploads = useCallback(
    async (nextToken?: string) => {
      if (nextToken) tokenRef.current = nextToken
      await chain.current
      await uploadMissing()
    },
    [uploadMissing],
  )

  return { flushPendingUploads, mergeUploadedMedia }
}
