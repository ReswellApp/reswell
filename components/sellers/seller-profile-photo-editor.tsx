"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ProfileAvatarCropDialog } from "@/components/features/dashboard/profile-avatar-crop-dialog"
import { ProfileAvatarImage } from "@/components/features/dashboard/profile-avatar-image"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import type { ProfileBannerFocal } from "@/lib/utils/profile-banner-focal"
import { cn } from "@/lib/utils"

type SellerProfilePhotoEditorProps = {
  initialPhotoUrl: string | null
  initialFocalX?: number | null
  initialFocalY?: number | null
  displayName: string
  editable?: boolean
  className?: string
}

export function SellerProfilePhotoEditor({
  initialPhotoUrl,
  initialFocalX,
  initialFocalY,
  displayName,
  editable = false,
  className,
}: SellerProfilePhotoEditorProps) {
  const router = useRouter()
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl)
  const [focalX, setFocalX] = useState<number | null>(initialFocalX ?? null)
  const [focalY, setFocalY] = useState<number | null>(initialFocalY ?? null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [cropRequestKey, setCropRequestKey] = useState(0)

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl)
    setFocalX(initialFocalX ?? null)
    setFocalY(initialFocalY ?? null)
  }, [initialPhotoUrl, initialFocalX, initialFocalY])

  useEffect(() => {
    if (cropRequestKey > 0 && photoUrl?.trim()) {
      setCropOpen(true)
    }
  }, [cropRequestKey, photoUrl])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const trimmedPhoto = photoUrl?.trim() || null
  const inputId = "seller-profile-photo-upload"
  const busy = uploading || removing

  async function handleUpload(file: File) {
    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      setPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
      toast.error(
        `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      const json = (await res.json()) as {
        data?: { avatarUrl: string; focalX?: number; focalY?: number }
        error?: string
      }
      if (!res.ok) {
        throw new Error(json.error || "Upload failed")
      }

      const nextPhotoUrl = json.data?.avatarUrl
      if (!nextPhotoUrl) throw new Error("Missing photo URL")

      setPhotoUrl(nextPhotoUrl)
      setFocalX(json.data?.focalX ?? 50)
      setFocalY(json.data?.focalY ?? 50)
      setPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
      setCropRequestKey((key) => key + 1)
      void revalidateListingDetailAfterProfileUpdate()
      dispatchHeaderAuthRefresh({ avatarUrl: nextPhotoUrl })
      router.refresh()
      toast.success("Profile photo updated")
    } catch (err: unknown) {
      setPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
      const message = err instanceof Error ? err.message : "Failed to upload photo"
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!trimmedPhoto) return

    setRemoving(true)
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
        credentials: "include",
      })

      const json = (await res.json()) as { data?: { removed: boolean }; error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Remove failed")
      }

      setPhotoUrl(null)
      setFocalX(null)
      setFocalY(null)
      void revalidateListingDetailAfterProfileUpdate()
      dispatchHeaderAuthRefresh({ avatarUrl: null })
      router.refresh()
      toast.success("Profile photo removed")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove photo"
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
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return localPreview
    })
    void handleUpload(file)
  }

  function handleCropSaved(focal: ProfileBannerFocal) {
    setFocalX(focal.x)
    setFocalY(focal.y)
    void revalidateListingDetailAfterProfileUpdate()
    dispatchHeaderAuthRefresh()
    router.refresh()
  }

  return (
    <>
      <div className={cn("relative shrink-0", className)}>
        <Avatar className="h-16 w-16 border border-border/80 shadow-sm sm:h-20 sm:w-20 lg:h-24 lg:w-24">
          <ProfileAvatarImage
            avatarUrl={trimmedPhoto}
            focalX={focalX}
            focalY={focalY}
            previewSrc={previewUrl}
            alt=""
          />
          <AvatarFallback className="bg-muted text-lg font-semibold text-foreground sm:text-xl">
            {displayName?.charAt(0).toUpperCase() || "S"}
          </AvatarFallback>
        </Avatar>

        {editable ? (
          <>
            <label
              htmlFor={inputId}
              className={cn(
                "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 transition-opacity",
                busy ? "pointer-events-none opacity-100" : "opacity-0 hover:opacity-100 focus-within:opacity-100",
                "[@media(pointer:coarse)]:opacity-100",
              )}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" aria-hidden />
              ) : (
                <Camera className="h-5 w-5 text-white" aria-hidden />
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
            {trimmedPhoto ? (
              <div className="absolute -bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setCropOpen(true)}
                  disabled={busy}
                  className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit crop
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  disabled={busy}
                  className="rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {trimmedPhoto ? (
        <ProfileAvatarCropDialog
          open={cropOpen}
          onOpenChange={setCropOpen}
          avatarUrl={trimmedPhoto}
          initialFocalX={focalX}
          initialFocalY={focalY}
          onSaved={handleCropSaved}
        />
      ) : null}
    </>
  )
}
