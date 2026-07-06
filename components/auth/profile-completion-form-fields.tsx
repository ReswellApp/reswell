"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react"
import type { User } from "@supabase/supabase-js"
import { Camera, Loader2, User as UserIcon } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import {
  getOAuthAvatarUrl,
  PROFILE_USERNAME_COMPLETED_METADATA_KEY,
  suggestProfileCompletionUsername,
  type ProfileCompletionRow,
} from "@/lib/auth/profile-completion"
import { validateDisplayName } from "@/lib/display-name-validation"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { headerInitialFromDisplayName } from "@/lib/header-user-display"
import { cn } from "@/lib/utils"

type ProfileCompletionFormFieldsProps = {
  user: User
  profile: ProfileCompletionRow
  onSuccess: () => void
}

export function ProfileCompletionFormFields({
  user,
  profile,
  onSuccess,
}: ProfileCompletionFormFieldsProps) {
  const supabase = useMemo(() => createClient(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState(() =>
    suggestProfileCompletionUsername(profile, user),
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)

  const oauthAvatarUrl = useMemo(() => getOAuthAvatarUrl(user), [user])
  const savedAvatarUrl = profile.avatar_url?.trim() || null
  const previewAvatarUrl = avatarPreviewUrl || savedAvatarUrl || oauthAvatarUrl
  const initial = headerInitialFromDisplayName(username || "User")

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      setError(
        `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    setError(null)
    setAvatarFile(file)
    setAvatarPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  async function uploadAvatarIfNeeded(): Promise<void> {
    if (!avatarFile) return

    const formData = new FormData()
    formData.append("file", avatarFile)

    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      body: formData,
      credentials: "include",
    })

    const json = (await res.json()) as { data?: { avatarUrl: string }; error?: string }
    if (!res.ok) {
      throw new Error(json.error || "Failed to upload profile photo")
    }
    if (!json.data?.avatarUrl) {
      throw new Error("Missing avatar URL after upload")
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const email = profile.email?.trim() || user.email?.trim() || null
    const nameCheck = validateDisplayName(username, email)
    if (!nameCheck.valid) {
      setError(nameCheck.error)
      return
    }

    setIsSubmitting(true)
    try {
      const trimmedName = username.trim()
      const completedAt = new Date().toISOString()

      let updateError = (
        await supabase
          .from("profiles")
          .update({
            display_name: trimmedName,
            profile_completed_at: completedAt,
            updated_at: completedAt,
          })
          .eq("id", user.id)
      ).error

      if (
        updateError &&
        (updateError.message.toLowerCase().includes("profile_completed_at") ||
          updateError.code === "42703" ||
          updateError.code === "PGRST204")
      ) {
        updateError = (
          await supabase
            .from("profiles")
            .update({
              display_name: trimmedName,
              updated_at: completedAt,
            })
            .eq("id", user.id)
        ).error
      }

      if (updateError) {
        throw new Error(updateError.message || "Failed to save profile")
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { [PROFILE_USERNAME_COMPLETED_METADATA_KEY]: true },
      })
      if (metadataError) {
        throw new Error(metadataError.message || "Failed to finalize profile")
      }

      await uploadAvatarIfNeeded()

      dispatchHeaderAuthRefresh({ displayName: trimmedName })
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="relative group shrink-0">
          <Avatar className="h-20 w-20 border-2 border-border">
            {previewAvatarUrl ? (
              <AvatarImage src={previewAvatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-lg bg-muted text-foreground">
              {username.trim() ? initial : <UserIcon className="h-8 w-8 text-muted-foreground" />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            className={cn(
              "absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100",
              "[@media(pointer:coarse)]:opacity-100",
            )}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Choose profile photo"
          >
            <Camera className="h-5 w-5 text-white" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="sr-only"
            onChange={handleAvatarChange}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-1 text-center sm:text-left">
          <p className="text-sm font-medium text-foreground">Profile photo</p>
          <p className="text-xs text-muted-foreground">Optional. Shown on your listings and messages.</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className={cn(
              "text-xs font-medium text-primary hover:underline",
              isSubmitting && "cursor-not-allowed opacity-60",
            )}
          >
            {avatarFile || savedAvatarUrl ? "Change photo" : "Add photo"}
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="profile-completion-username">
          Username <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id="profile-completion-username"
          type="text"
          placeholder="e.g. SurferJoe"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={5}
          autoComplete="username"
          aria-required="true"
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          At least 5 characters. Shown on your profile, listings, and messages — not your email.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : (
          "Save and continue"
        )}
      </Button>
    </form>
  )
}
