"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileAddressesManager } from "@/components/profile-addresses-manager"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { Check, Loader2, Save, LogOut, Camera, User, KeyRound, ImageIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { validateDisplayName } from "@/lib/display-name-validation"
import { useLocale } from "@/components/locale-provider"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { HEADER_AUTH_REFRESH_EVENT } from "@/lib/auth/header-auth-refresh"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import { SELLER_PROFILE_BANNER_DEFAULT } from "@/lib/brand-colors"
import { cn } from "@/lib/utils"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { requestPasswordResetAction } from "@/lib/actions/passwordReset"
import { ProfileChangePasswordSection } from "@/components/features/dashboard/profile-change-password-section"
import type { DashboardProfileRow } from "@/lib/db/dashboard-profile"
import type { ProfileAddressRow } from "@/lib/profile-address"

type ProfileSettingsTab = "profile" | "addresses"

interface DashboardProfileSettingsProps {
  initialProfile: DashboardProfileRow | null
  profileFetchError?: string
  initialAddresses: ProfileAddressRow[]
  addressesFetchError?: string
}

export function DashboardProfileSettings({
  initialProfile,
  profileFetchError,
  initialAddresses,
  addressesFetchError,
}: DashboardProfileSettingsProps) {
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<ProfileSettingsTab>("profile")
  const [profile, setProfile] = useState<DashboardProfileRow | null>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [profileSavedFlash, setProfileSavedFlash] = useState(false)
  const [avatarSavedFlash, setAvatarSavedFlash] = useState(false)
  const [bannerSavedFlash, setBannerSavedFlash] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [removingBanner, setRemovingBanner] = useState(false)
  const [resetPasswordSending, setResetPasswordSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setProfile(initialProfile)
  }, [initialProfile])

  useEffect(() => {
    const applyHash = () => {
      const raw = window.location.hash.replace(/^#/, "")
      if (raw === "addresses") setActiveTab("addresses")
      else setActiveTab("profile")
    }
    applyHash()
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
  }, [])

  function handleTabChange(value: string) {
    const v = value as ProfileSettingsTab
    setActiveTab(v)
    if (typeof window === "undefined") return
    const base = window.location.pathname + window.location.search
    if (v === "profile") {
      window.history.replaceState(null, "", base)
    } else {
      window.history.replaceState(null, "", `${base}#${v}`)
    }
  }

  async function handleSave() {
    if (!profile) return

    const nameCheck = validateDisplayName(profile.display_name, profile.email)
    if (!nameCheck.valid) {
      toast.error(nameCheck.error)
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profile.display_name,
        location: profile.location,
        city: profile.city,
        bio: profile.bio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (!error) {
      setProfileSavedFlash(true)
      window.setTimeout(() => setProfileSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      router.refresh()
    } else {
      toast.error("Failed to update profile")
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      toast.error(
        `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    setUploadingAvatar(true)
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

      const avatarUrl = json.data?.avatarUrl
      if (!avatarUrl) throw new Error("Missing avatar URL")

      setProfile({ ...profile, avatar_url: avatarUrl })
      setAvatarSavedFlash(true)
      window.setTimeout(() => setAvatarSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      router.refresh()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to upload photo"
      console.error("Avatar upload error:", message)
      toast.error(message)
    } finally {
      setUploadingAvatar(false)
      e.target.value = ""
    }
  }

  async function handleRemoveAvatar() {
    if (!profile?.avatar_url) return

    setRemovingAvatar(true)
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
        credentials: "include",
      })

      const json = (await res.json()) as { data?: { removed: boolean }; error?: string }

      if (!res.ok) {
        throw new Error(json.error || "Remove failed")
      }

      setProfile({ ...profile, avatar_url: null })
      setAvatarSavedFlash(true)
      window.setTimeout(() => setAvatarSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      window.dispatchEvent(new Event(HEADER_AUTH_REFRESH_EVENT))
      router.refresh()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove photo"
      console.error("Avatar remove error:", message)
      toast.error(message)
    } finally {
      setRemovingAvatar(false)
    }
  }

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    if (file.size > PROFILE_BANNER_MAX_INPUT_BYTES) {
      toast.error(
        `Image must be under ${Math.round(PROFILE_BANNER_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    setUploadingBanner(true)
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

      const bannerUrl = json.data?.bannerUrl
      if (!bannerUrl) throw new Error("Missing banner URL")

      setProfile({ ...profile, shop_banner_url: bannerUrl })
      setBannerSavedFlash(true)
      window.setTimeout(() => setBannerSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload banner"
      console.error("Banner upload error:", message)
      toast.error(message)
    } finally {
      setUploadingBanner(false)
      e.target.value = ""
    }
  }

  async function handleRemoveBanner() {
    if (!profile?.shop_banner_url) return

    setRemovingBanner(true)
    try {
      const res = await fetch("/api/profile/banner", {
        method: "DELETE",
        credentials: "include",
      })

      const json = (await res.json()) as { data?: { removed: boolean }; error?: string }

      if (!res.ok) {
        throw new Error(json.error || "Remove failed")
      }

      setProfile({ ...profile, shop_banner_url: null })
      setBannerSavedFlash(true)
      window.setTimeout(() => setBannerSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove banner"
      console.error("Banner remove error:", message)
      toast.error(message)
    } finally {
      setRemovingBanner(false)
    }
  }

  async function handleSendPasswordReset() {
    const acctStrings = t("settings").account
    if (!profile?.email) {
      toast.error(acctStrings.resetPasswordToastNoEmail)
      return
    }
    setResetPasswordSending(true)
    try {
      const result = await requestPasswordResetAction({
        email: profile.email,
        siteOrigin: window.location.origin,
      })
      if ("error" in result) throw new Error(result.error)
      toast.success(acctStrings.resetPasswordToastSuccess)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email")
    } finally {
      setResetPasswordSending(false)
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut()
    } catch {
      // Still navigate home so the user is not stuck in an authenticated shell.
    }
    window.location.assign("/")
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {profileFetchError ? "Could not load profile. Please refresh the page." : "Profile not found"}
        </p>
      </div>
    )
  }

  const s = t("settings")
  const p = s.profile
  const a = s.account
  const addr = s.addresses

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{s.title}</h1>
        <p className="text-muted-foreground">{s.subtitle}</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">{s.profileTab}</TabsTrigger>
          <TabsTrigger value="addresses">{addr.tab}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{p.title}</CardTitle>
              <CardDescription>{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-2 border-border">
                    <AvatarImage
                      src={
                        profile.avatar_url
                          ? profileMediaDisplaySrc(profile.avatar_url)
                          : undefined
                      }
                      alt={profile.display_name}
                    />
                    <AvatarFallback className="text-lg bg-muted">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar || removingAvatar}
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{p.photo}</p>
                  <p className="text-xs text-muted-foreground">{p.photoHint}</p>
                  {avatarSavedFlash ? (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
                      Updated
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <label
                      htmlFor="avatar-upload"
                      className={cn(
                        "inline-flex items-center text-xs font-medium text-primary hover:underline",
                        uploadingAvatar || removingAvatar
                          ? "cursor-not-allowed opacity-60"
                          : "cursor-pointer",
                      )}
                    >
                      {uploadingAvatar ? p.uploading : p.changePhoto}
                    </label>
                    {profile.avatar_url ? (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar || removingAvatar}
                        className="inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground disabled:hover:no-underline"
                      >
                        {removingAvatar ? p.removingPhoto : p.removePhoto}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.banner}</p>
                  <p className="text-xs text-muted-foreground">{p.bannerHint}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.bannerDefaultHint}</p>
                </div>
                <div className="relative group overflow-hidden rounded-xl border border-border">
                  <div
                    className="relative aspect-[4/1] w-full min-h-[88px] sm:min-h-[104px]"
                    style={
                      profile.shop_banner_url?.trim()
                        ? undefined
                        : { backgroundColor: SELLER_PROFILE_BANNER_DEFAULT }
                    }
                  >
                    {profile.shop_banner_url ? (
                      <Image
                        src={profileMediaDisplaySrc(profile.shop_banner_url)}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 640px"
                        className="object-cover"
                        unoptimized={listingImageShouldBypassOptimization(
                          profileMediaDisplaySrc(profile.shop_banner_url),
                        )}
                      />
                    ) : null}
                    <label
                      htmlFor="banner-upload"
                      className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-white" />
                      )}
                    </label>
                    <input
                      id="banner-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                      className="hidden"
                      onChange={handleBannerUpload}
                      disabled={uploadingBanner || removingBanner}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {bannerSavedFlash ? (
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
                      Updated
                    </p>
                  ) : null}
                  <label
                    htmlFor="banner-upload"
                    className={cn(
                      "inline-flex items-center text-xs font-medium text-primary hover:underline",
                      uploadingBanner || removingBanner
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer",
                    )}
                  >
                    {uploadingBanner ? p.uploading : p.changeBanner}
                  </label>
                  {profile.shop_banner_url ? (
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      disabled={uploadingBanner || removingBanner}
                      className="inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground disabled:hover:no-underline"
                    >
                      {removingBanner ? p.removingBanner : p.removeBanner}
                    </button>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="email">{p.email}</Label>
                <Input id="email" type="email" value={profile.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">{p.emailHint}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">
                  {p.displayName} <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Input
                  id="display_name"
                  value={profile.display_name || ""}
                  onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
                  placeholder={p.displayNamePlaceholder}
                  required
                  aria-required="true"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">{p.location}</Label>
                  <Input
                    id="location"
                    value={profile.location || ""}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    placeholder={p.locationPlaceholder}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">{p.city}</Label>
                  <Input
                    id="city"
                    value={profile.city || ""}
                    onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    placeholder={p.cityPlaceholder}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{p.bio}</Label>
                <Textarea
                  id="bio"
                  value={profile.bio || ""}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder={p.bioPlaceholder}
                  rows={4}
                />
              </div>

              <Button onClick={handleSave} disabled={saving || profileSavedFlash}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {p.saving}
                  </>
                ) : profileSavedFlash ? (
                  <>
                    <Check className="h-4 w-4 mr-2" aria-hidden />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {p.save}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="mt-6">
          <ProfileAddressesManager
            copy={addr}
            initialAddresses={initialAddresses}
            fetchError={addressesFetchError}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{a.title}</CardTitle>
          <CardDescription>{a.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfileChangePasswordSection email={profile.email} copy={a} />
          <Separator />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">{a.resetPassword}</p>
              <p className="text-sm text-muted-foreground">{a.resetPasswordDescription}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0 self-start sm:self-auto"
              onClick={() => void handleSendPasswordReset()}
              disabled={resetPasswordSending || !profile.email}
            >
              <KeyRound className="mr-2 h-4 w-4" aria-hidden />
              {resetPasswordSending ? a.resetPasswordSending : a.resetPasswordButton}
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">{a.signOut}</p>
              <p className="text-sm text-muted-foreground">{a.signOutDescription}</p>
            </div>
            <Button variant="outline" className="shrink-0 self-start sm:self-auto" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" aria-hidden />
              {a.signOut}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
