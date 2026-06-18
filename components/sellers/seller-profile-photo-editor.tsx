"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { cn } from "@/lib/utils"

type SellerProfilePhotoEditorProps = {
  initialPhotoUrl: string | null
  displayName: string
  editable?: boolean
  className?: string
}

export function SellerProfilePhotoEditor({
  initialPhotoUrl,
  displayName,
  editable = false,
  className,
}: SellerProfilePhotoEditorProps) {
  const router = useRouter()
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl)
  }, [initialPhotoUrl])

  const trimmedPhoto = photoUrl?.trim() || null
  const photoSrc = trimmedPhoto ? profileMediaDisplaySrc(trimmedPhoto) : undefined
  const inputId = "seller-profile-photo-upload"
  const busy = uploading || removing

  async function handleUpload(file: File) {
    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
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

      const json = (await res.json()) as { data?: { avatarUrl: string }; error?: string }
      if (!res.ok) {
        throw new Error(json.error || "Upload failed")
      }

      const nextPhotoUrl = json.data?.avatarUrl
      if (!nextPhotoUrl) throw new Error("Missing photo URL")

      setPhotoUrl(nextPhotoUrl)
      void revalidateListingDetailAfterProfileUpdate()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      router.refresh()
      toast.success("Profile photo updated")
    } catch (err: unknown) {
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
      void revalidateListingDetailAfterProfileUpdate()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
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
    void handleUpload(file)
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className="h-16 w-16 border border-border/80 shadow-sm sm:h-20 sm:w-20 lg:h-24 lg:w-24">
        <AvatarImage src={photoSrc} alt="" />
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
            <button
              type="button"
              onClick={() => void handleRemove()}
              disabled={busy}
              className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
