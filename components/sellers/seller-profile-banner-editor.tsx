"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ImageIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { wideShimmer } from "@/lib/image-shimmer"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { sellerProfileBannerImageSizes } from "@/lib/sellers/seller-profile-layout"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { cn } from "@/lib/utils"

type SellerProfileBannerEditorProps = {
  initialBannerUrl: string | null
  monogram: string
  editable?: boolean
}

export function SellerProfileBannerEditor({
  initialBannerUrl,
  monogram,
  editable = false,
}: SellerProfileBannerEditorProps) {
  const router = useRouter()
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setBannerUrl(initialBannerUrl)
  }, [initialBannerUrl])

  const trimmedBanner = bannerUrl?.trim() || null
  const bannerSrc = trimmedBanner ? profileMediaDisplaySrc(trimmedBanner) : null
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

      const json = (await res.json()) as { data?: { bannerUrl: string }; error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Upload failed")
      }

      const nextBannerUrl = json.data?.bannerUrl
      if (!nextBannerUrl) throw new Error("Missing banner URL")

      setBannerUrl(nextBannerUrl)
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

  const busy = uploading || removing

  return (
    <>
      {bannerSrc ? (
        <Image
          src={bannerSrc}
          alt=""
          fill
          priority
          sizes={sellerProfileBannerImageSizes}
          className="object-cover"
          unoptimized={listingImageShouldBypassOptimization(bannerSrc)}
          placeholder="blur"
          blurDataURL={wideShimmer}
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
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="absolute bottom-3 right-3 z-10 rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-black/70 disabled:cursor-not-allowed disabled:opacity-60 sm:bottom-4 sm:right-4"
            >
              {removing ? "Removing…" : "Remove banner"}
            </button>
          ) : null}
        </>
      ) : null}
    </>
  )
}
