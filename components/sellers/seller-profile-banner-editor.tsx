"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Crop, ImageIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ProfileBannerCropDialog } from "@/components/features/dashboard/profile-banner-crop-dialog"
import { ProfileBannerImage } from "@/components/features/dashboard/profile-banner-image"
import { sellerProfileBannerImageSizes } from "@/lib/sellers/seller-profile-layout"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import {
  PROFILE_BANNER_FOCAL_DEFAULT,
  resolveProfileBannerFocal,
  type ProfileBannerFocal,
} from "@/lib/utils/profile-banner-focal"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { cn } from "@/lib/utils"

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
  const [focal, setFocal] = useState<ProfileBannerFocal>(() =>
    resolveProfileBannerFocal(initialFocalX, initialFocalY),
  )
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropRequestKey, setCropRequestKey] = useState(0)

  useEffect(() => {
    setBannerUrl(initialBannerUrl)
  }, [initialBannerUrl])

  useEffect(() => {
    setFocal(resolveProfileBannerFocal(initialFocalX, initialFocalY))
  }, [initialFocalX, initialFocalY])

  useEffect(() => {
    if (cropRequestKey > 0 && bannerUrl?.trim()) {
      setCropOpen(true)
    }
  }, [cropRequestKey, bannerUrl])

  const trimmedBanner = bannerUrl?.trim() || null
  const inputId = "seller-profile-banner-upload"

  async function handleUpload(file: File) {
    if (file.size > PROFILE_BANNER_MAX_INPUT_BYTES) {
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

      setBannerUrl(nextBannerUrl)
      setFocal(resolveProfileBannerFocal(json.data?.focalX, json.data?.focalY))
      setCropRequestKey((key) => key + 1)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()
      toast.success("Banner updated")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload banner"
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!trimmedBanner) return

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
    void handleUpload(file)
  }

  function handleCropSaved(nextFocal: ProfileBannerFocal) {
    setFocal(nextFocal)
    void revalidateListingDetailAfterProfileUpdate()
    router.refresh()
  }

  const busy = uploading || removing

  return (
    <>
      {trimmedBanner ? (
        <ProfileBannerImage
          bannerUrl={trimmedBanner}
          focal={focal}
          priority
          sizes={sellerProfileBannerImageSizes}
          placeholder="blur"
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
              "absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 transition-opacity",
              busy ? "pointer-events-none opacity-100" : "opacity-0 hover:opacity-100 focus-within:opacity-100",
              "[@media(pointer:coarse)]:opacity-100",
            )}
          >
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden />
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white">
                <ImageIcon className="h-4 w-4" aria-hidden />
                {trimmedBanner ? "Change banner" : "Upload banner"}
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
          {trimmedBanner ? (
            <div className="absolute bottom-3 right-3 z-10 flex flex-wrap items-center justify-end gap-2 sm:bottom-4 sm:right-4">
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Crop className="h-3.5 w-3.5" aria-hidden />
                Edit banner
              </button>
              <button
                type="button"
                onClick={() => void handleRemove()}
                disabled={busy}
                className="rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? "Removing…" : "Remove banner"}
              </button>
            </div>
          ) : null}
          {trimmedBanner ? (
            <ProfileBannerCropDialog
              open={cropOpen}
              onOpenChange={setCropOpen}
              bannerUrl={trimmedBanner}
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
