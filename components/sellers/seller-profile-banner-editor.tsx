"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Crop, ImageIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ProfileBannerCropDialog } from "@/components/features/dashboard/profile-banner-crop-dialog"
import { ProfileBannerImage } from "@/components/features/dashboard/profile-banner-image"
import { sellerProfileBannerImageSizes } from "@/lib/sellers/seller-profile-layout"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import {
  PROFILE_BANNER_FOCAL_DEFAULT,
  resolveProfileBannerFocal,
  type ProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { cn } from "@/lib/utils"

function mediaCacheBusterMs(url: string | null | undefined): number | null {
  if (!url?.trim()) return null
  try {
    const parsed = new URL(url, "https://reswell.local")
    const t = parsed.searchParams.get("t")
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function revokeBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url)
}

function prefetchImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

type SellerProfileBannerEditorProps = {
  initialBannerUrl: string | null
  initialFocalX?: number | null
  initialFocalY?: number | null
  monogram: string
  editable?: boolean
}

export function SellerProfileBannerEditor({
  initialBannerUrl,
  initialFocalX,
  initialFocalY,
  monogram,
  editable = false,
}: SellerProfileBannerEditorProps) {
  const router = useRouter()
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [focal, setFocal] = useState<ProfileBannerFocal>(() =>
    resolveProfileBannerFocal(initialFocalX, initialFocalY),
  )
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropRequestKey, setCropRequestKey] = useState(0)
  /** Ignore stale RSC props after a local mutation until the server catches up. */
  const localMutationPendingRef = useRef(false)
  const cropOpenRef = useRef(false)

  useEffect(() => {
    cropOpenRef.current = cropOpen
  }, [cropOpen])

  useEffect(() => {
    if (localMutationPendingRef.current) {
      const localT = mediaCacheBusterMs(bannerUrl)
      const propT = mediaCacheBusterMs(initialBannerUrl)

      // Keep optimistic upload until the refreshed page carries an equal/newer URL.
      if (bannerUrl && (!initialBannerUrl || (localT != null && propT != null && propT < localT))) {
        return
      }
      // Keep optimistic remove until the refreshed page clears the banner.
      if (!bannerUrl && initialBannerUrl) {
        return
      }
      localMutationPendingRef.current = false
    }

    setBannerUrl(initialBannerUrl)
    // bannerUrl is intentionally read for the pending-mutation guard, not a sync source.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from server props only
  }, [initialBannerUrl])

  useEffect(() => {
    if (localMutationPendingRef.current) return
    setFocal(resolveProfileBannerFocal(initialFocalX, initialFocalY))
  }, [initialFocalX, initialFocalY])

  useEffect(() => {
    if (cropRequestKey > 0 && (bannerUrl?.trim() || previewUrl?.trim())) {
      setCropOpen(true)
    }
  }, [cropRequestKey, bannerUrl, previewUrl])

  useEffect(() => {
    return () => {
      revokeBlobUrl(previewUrl)
    }
  }, [previewUrl])

  const trimmedBanner = bannerUrl?.trim() || null
  const hasBannerVisual = Boolean(trimmedBanner || previewUrl?.trim())
  const inputId = "seller-profile-banner-upload"

  function clearPreview() {
    setPreviewUrl((prev) => {
      revokeBlobUrl(prev)
      return null
    })
  }

  async function settleRemoteBanner(nextBannerUrl: string) {
    const displaySrc = profileMediaDisplaySrc(nextBannerUrl)
    await prefetchImage(displaySrc)
    // Keep the local preview while the crop dialog is open so repositioning stays instant.
    if (!cropOpenRef.current) {
      clearPreview()
    }
  }

  async function handleUpload(file: File) {
    if (file.size > PROFILE_BANNER_MAX_INPUT_BYTES) {
      clearPreview()
      toast.error(
        `Image must be under ${Math.round(PROFILE_BANNER_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/profile/banner", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      const json = (await res.json()) as {
        data?: { bannerUrl: string; focalX?: number; focalY?: number }
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || "Upload failed")
      }

      const nextBannerUrl = json.data?.bannerUrl
      if (!nextBannerUrl) throw new Error("Missing banner URL")

      localMutationPendingRef.current = true
      setBannerUrl(nextBannerUrl)
      setFocal(resolveProfileBannerFocal(json.data?.focalX, json.data?.focalY))
      setCropRequestKey((key) => key + 1)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()
      toast.success("Banner updated")
      void settleRemoteBanner(nextBannerUrl)
    } catch (err: unknown) {
      clearPreview()
      const message = err instanceof Error ? err.message : "Failed to upload banner"
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!trimmedBanner && !previewUrl) return

    setRemoving(true)
    try {
      const res = await fetch("/api/profile/banner", {
        method: "DELETE",
        credentials: "include",
      })

      const json = (await res.json()) as { data?: { removed: boolean }; error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Remove failed")
      }

      localMutationPendingRef.current = true
      clearPreview()
      setBannerUrl(null)
      setFocal(PROFILE_BANNER_FOCAL_DEFAULT)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()
      toast.success("Banner removed")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove banner"
      toast.error(message)
    } finally {
      setRemoving(false)
    }
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      revokeBlobUrl(prev)
      return localPreview
    })
    setFocal(PROFILE_BANNER_FOCAL_DEFAULT)
    void handleUpload(file)
  }

  function handleCropSaved(nextFocal: ProfileBannerFocal) {
    setFocal(nextFocal)
    void revalidateListingDetailAfterProfileUpdate()
    router.refresh()
  }

  function handleCropOpenChange(open: boolean) {
    setCropOpen(open)
    if (!open && trimmedBanner) {
      // Remote should already be warm; drop the blob once the editor closes.
      void settleRemoteBanner(trimmedBanner)
    }
  }

  const busy = uploading || removing

  return (
    <>
      {hasBannerVisual ? (
        <ProfileBannerImage
          bannerUrl={trimmedBanner}
          previewSrc={previewUrl}
          focal={focal}
          priority
          sizes={sellerProfileBannerImageSizes}
          placeholder={previewUrl ? "empty" : "blur"}
        />
      ) : (
        <div className="flex h-full min-h-[inherit] items-center justify-center px-6">
          <span className="select-none text-4xl font-black tracking-[0.2em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {monogram}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />

      {editable ? (
        <>
          <label
            htmlFor={inputId}
            className={cn(
              "absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity",
              busy && previewUrl
                ? "pointer-events-none bg-black/15 opacity-100"
                : "bg-black/40",
              busy && !previewUrl
                ? "pointer-events-none opacity-100"
                : !busy
                  ? "opacity-0 hover:opacity-100 focus-within:opacity-100"
                  : null,
              !busy && "[@media(pointer:coarse)]:opacity-100",
            )}
          >
            {busy ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-sm font-semibold text-white">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {uploading ? "Uploading…" : "Removing…"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white">
                <ImageIcon className="h-4 w-4" aria-hidden />
                {hasBannerVisual ? "Change banner" : "Upload banner"}
              </span>
            )}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            onChange={onFileChange}
            disabled={busy}
          />
          {hasBannerVisual ? (
            <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2 sm:bottom-4 sm:right-4">
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                disabled={busy || !trimmedBanner}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Crop className="h-3.5 w-3.5" aria-hidden />
                Edit banner
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={busy || !trimmedBanner}
                className="rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? "Removing…" : "Remove banner"}
              </button>
            </div>
          ) : null}
          {trimmedBanner ? (
            <ProfileBannerCropDialog
              open={cropOpen}
              onOpenChange={handleCropOpenChange}
              bannerUrl={trimmedBanner}
              previewSrc={previewUrl}
              initialFocalX={focal.x}
              initialFocalY={focal.y}
              onSaved={handleCropSaved}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
