"use client"

import React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ProfilePersonalInfoSection } from "@/components/features/dashboard/profile-personal-info-section"
import { ProfileAddressesManager } from "@/components/profile-addresses-manager"
import { toast } from "sonner"
import { validateDisplayName } from "@/lib/display-name-validation"
import { useLocale } from "@/components/locale-provider"
import { revalidateListingDetailAfterProfileUpdate } from "@/app/actions/listing-detail-cache"
import { dispatchHeaderAuthRefresh } from "@/lib/auth/header-auth-refresh"
import { PROFILE_AVATAR_MAX_INPUT_BYTES } from "@/lib/validations/profileAvatar"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { buildPasswordRecoveryCallbackUrl } from "@/lib/auth/password-recovery-callback-url"
import { signOutAndRedirect } from "@/lib/auth/sign-out-and-redirect"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import {
  ProfileSettingsTabNav,
  profileSettingsHashForTab,
  profileSettingsTabFromHash,
  type ProfileSettingsTabId,
} from "@/components/features/dashboard/profile-settings/profile-settings-tab-nav"
import { ProfileShopTab } from "@/components/features/dashboard/profile-settings/profile-shop-tab"
import { ProfileSignInTab } from "@/components/features/dashboard/profile-settings/profile-sign-in-tab"
import { ProfileNotificationsTab } from "@/components/features/dashboard/profile-settings/profile-notifications-tab"
import { sellerProfileHref } from "@/lib/seller-slug"
import type { DashboardProfileRow } from "@/lib/db/dashboard-profile"
import type { ProfileAddressRow } from "@/lib/profile-address"

interface DashboardProfileSettingsProps {
  initialProfile: DashboardProfileRow | null
  profileFetchError?: string
  initialAddresses: ProfileAddressRow[]
  addressesFetchError?: string
  initialMessageSmsOptIn?: boolean
  initialHasSmsPhone?: boolean
  initialSmsPhone?: string | null
  variant?: "dashboard" | "threads"
}

export function DashboardProfileSettings({
  initialProfile,
  profileFetchError,
  initialAddresses,
  addressesFetchError,
  initialMessageSmsOptIn = false,
  initialHasSmsPhone = false,
  initialSmsPhone = null,
  variant = "dashboard",
}: DashboardProfileSettingsProps) {
  const isThreads = variant === "threads"
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<ProfileSettingsTabId>("shop")
  const [profile, setProfile] = useState<DashboardProfileRow | null>(initialProfile)
  const [saving, setSaving] = useState(false)
  const [profileSavedFlash, setProfileSavedFlash] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [removingBanner, setRemovingBanner] = useState(false)
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null)
  const [bannerSavedFlash, setBannerSavedFlash] = useState(false)
  const [avatarCropRequestKey, setAvatarCropRequestKey] = useState(0)
  const [bannerCropRequestKey, setBannerCropRequestKey] = useState(0)
  const [resetPasswordSending, setResetPasswordSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setProfile(initialProfile)
  }, [initialProfile])

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreviewUrl)
      }
    }
  }, [avatarPreviewUrl])

  useEffect(() => {
    return () => {
      if (bannerPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(bannerPreviewUrl)
      }
    }
  }, [bannerPreviewUrl])

  useEffect(() => {
    const applyHash = () => {
      setActiveTab(profileSettingsTabFromHash(window.location.hash))
    }
    applyHash()
    window.addEventListener("hashchange", applyHash)
    return () => window.removeEventListener("hashchange", applyHash)
  }, [])

  function handleTabChange(tab: ProfileSettingsTabId) {
    setActiveTab(tab)
    if (typeof window === "undefined") return
    const base = window.location.pathname + window.location.search
    const hash = profileSettingsHashForTab(tab)
    window.history.replaceState(null, "", hash ? `${base}#${hash}` : base)
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
      dispatchHeaderAuthRefresh()
      router.refresh()
    } else {
      toast.error("Failed to update profile")
    }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !profile) return

    if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      toast.error(
        `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      return
    }

    const localPreview = URL.createObjectURL(file)
    setAvatarPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return localPreview
    })

    setUploadingAvatar(true)
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

      const avatarUrl = json.data?.avatarUrl
      if (!avatarUrl) throw new Error("Missing avatar URL")

      setProfile({
        ...profile,
        avatar_url: avatarUrl,
        avatar_focal_x_pct: json.data?.focalX ?? 50,
        avatar_focal_y_pct: json.data?.focalY ?? 50,
        shop_logo_url: profile.is_shop ? avatarUrl : profile.shop_logo_url,
      })
      setAvatarPreviewUrl(null)
      URL.revokeObjectURL(localPreview)
      setAvatarCropRequestKey((key) => key + 1)
      void revalidateListingDetailAfterProfileUpdate()
      dispatchHeaderAuthRefresh({ avatarUrl })
      router.refresh()
      toast.success("Profile photo updated")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload photo"
      console.error("Avatar upload error:", message)
      toast.error(message)
    } finally {
      setUploadingAvatar(false)
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

      setProfile({
        ...profile,
        avatar_url: null,
        avatar_focal_x_pct: null,
        avatar_focal_y_pct: null,
        shop_logo_url: profile.is_shop ? null : profile.shop_logo_url,
      })
      void revalidateListingDetailAfterProfileUpdate()
      dispatchHeaderAuthRefresh({ avatarUrl: null })
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove photo"
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
      setBannerPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
      toast.error(
        `Image must be under ${Math.round(PROFILE_BANNER_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
      )
      e.target.value = ""
      return
    }

    const localPreview = URL.createObjectURL(file)
    setBannerPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
      return localPreview
    })

    setUploadingBanner(true)
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

      const bannerUrl = json.data?.bannerUrl
      if (!bannerUrl) throw new Error("Missing banner URL")

      setProfile({
        ...profile,
        shop_banner_url: bannerUrl,
        shop_banner_focal_x_pct: json.data?.focalX ?? 50,
        shop_banner_focal_y_pct: json.data?.focalY ?? 50,
      })
      setBannerCropRequestKey((key) => key + 1)
      setBannerSavedFlash(true)
      window.setTimeout(() => setBannerSavedFlash(false), 2000)
      void revalidateListingDetailAfterProfileUpdate()
      router.refresh()

      // Keep the local preview until the remote image is warm, then drop the blob.
      const remote = new window.Image()
      const clearBannerPreview = () => {
        setBannerPreviewUrl((prev) => {
          if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
          return null
        })
      }
      remote.onload = clearBannerPreview
      remote.onerror = clearBannerPreview
      remote.src = profileMediaDisplaySrc(bannerUrl)
    } catch (err: unknown) {
      setBannerPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
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

      setBannerPreviewUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev)
        return null
      })
      setProfile({
        ...profile,
        shop_banner_url: null,
        shop_banner_focal_x_pct: null,
        shop_banner_focal_y_pct: null,
      })
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
      let siteOrigin = window.location.origin
      const devOverride = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL?.trim()
      if (devOverride && process.env.NODE_ENV === "development") {
        try {
          const u = new URL(devOverride.startsWith("http") ? devOverride : `https://${devOverride}`)
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            siteOrigin = `${u.protocol}//${u.host}`
          }
        } catch {
          /* keep window.location.origin */
        }
      }
      const redirectTo = buildPasswordRecoveryCallbackUrl(siteOrigin)
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, { redirectTo })
      if (error) throw error
      toast.success(acctStrings.resetPasswordToastSuccess)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email")
    } finally {
      setResetPasswordSending(false)
    }
  }

  async function handleSignOut() {
    signOutAndRedirect(isThreads ? "/threads" : undefined)
  }

  if (!profile) {
    return (
      <div className="py-12 text-center">
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
  const sellerStoreHref = profile.seller_slug?.trim() ? sellerProfileHref(profile) : null

  return (
    <div className="space-y-6">
      {!isThreads ? <DashboardPageHeader title={s.title} description={s.subtitle} /> : null}

      <ProfileSettingsTabNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        variant={variant}
        labels={{
          shop: isThreads ? "Profile" : s.shopTab,
          signIn: s.signInTab,
          addresses: addr.tab,
          notifications: s.notificationsTab,
        }}
      />

      {activeTab === "shop" ? (
        <ProfileShopTab
          profile={profile}
          copy={{
            displayName: p.displayName,
            displayNamePlaceholder: p.displayNamePlaceholder,
            username: p.username,
            bio: p.bio,
            bioPlaceholder: p.bioPlaceholder,
            location: p.location,
            locationPlaceholder: p.locationPlaceholder,
            city: p.city,
            cityPlaceholder: p.cityPlaceholder,
            editPhoto: p.editPhoto,
            editPhotoTitle: p.editPhotoTitle,
            editPhotoDescription: p.editPhotoDescription,
            editPhotoHint: p.editPhotoHint,
            editPhotoNoPanHint: p.editPhotoNoPanHint,
            editPhotoSave: p.editPhotoSave,
            editPhotoSaving: p.editPhotoSaving,
            editPhotoCancel: p.editPhotoCancel,
            banner: p.banner,
            bannerHint: p.bannerHint,
            changeBanner: p.changeBanner,
            editBanner: p.editBanner,
            removeBanner: p.removeBanner,
            uploading: p.uploading,
            removingBanner: p.removingBanner,
            editBannerTitle: p.editBannerTitle,
            editBannerDescription: p.editBannerDescription,
            editBannerHint: p.editBannerHint,
            editBannerSave: p.editBannerSave,
            editBannerSaving: p.editBannerSaving,
            editBannerCancel: p.editBannerCancel,
            save: p.save,
            saving: p.saving,
            saved: p.saved,
            seeMyStore: p.seeMyStore,
            sellerBannerTitle: p.sellerBannerTitle,
          }}
          sellerStoreHref={sellerStoreHref}
          saving={saving}
          savedFlash={profileSavedFlash}
          uploadingAvatar={uploadingAvatar}
          removingAvatar={removingAvatar}
          avatarPreviewUrl={avatarPreviewUrl}
          avatarCropRequestKey={avatarCropRequestKey}
          uploadingBanner={uploadingBanner}
          removingBanner={removingBanner}
          bannerPreviewUrl={bannerPreviewUrl}
          bannerSavedFlash={bannerSavedFlash}
          bannerCropRequestKey={bannerCropRequestKey}
          onProfileChange={(patch) => setProfile({ ...profile, ...patch })}
          onSave={() => void handleSave()}
          onAvatarUpload={(e) => void handleAvatarUpload(e)}
          onRemoveAvatar={() => void handleRemoveAvatar()}
          onBannerUpload={(e) => void handleBannerUpload(e)}
          onRemoveBanner={() => void handleRemoveBanner()}
        />
      ) : null}

      {activeTab === "sign-in" ? (
        <ProfileSignInTab
          email={profile.email || ""}
          copy={{
            ...a,
            loginMethods: a.loginMethods,
            signedInWithGoogle: a.signedInWithGoogle,
            signedInWithEmail: a.signedInWithEmail,
            emailVerification: a.emailVerification,
            verified: a.verified,
            changeEmailTitle: a.changeEmailTitle,
            newEmail: a.newEmail,
            updateEmail: a.updateEmail,
          }}
          resetPasswordSending={resetPasswordSending}
          onSendPasswordReset={() => void handleSendPasswordReset()}
          onSignOut={() => void handleSignOut()}
        />
      ) : null}

      {activeTab === "addresses" ? (
        <div className="mx-auto max-w-xl space-y-6 pt-2">
          <ProfilePersonalInfoSection
            copy={s.personalInfo}
            initialFirstName={profile.first_name}
            initialLastName={profile.last_name}
            initialPhone={profile.phone}
          />
          <ProfileAddressesManager
            copy={addr}
            initialAddresses={initialAddresses}
            fetchError={addressesFetchError}
          />
        </div>
      ) : null}

      {activeTab === "notifications" ? (
        <ProfileNotificationsTab
          copy={s.notifications}
          initialMessageSmsOptIn={initialMessageSmsOptIn}
          initialPhone={initialSmsPhone}
        />
      ) : null}
    </div>
  )
}
