"use client"

import Link from "next/link"
import Image from "next/image"
import { Check, ExternalLink, ImageIcon, Loader2, Pencil, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SELLER_PROFILE_BANNER_DEFAULT } from "@/lib/brand-colors"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { cn } from "@/lib/utils"
import type { DashboardProfileRow } from "@/lib/db/dashboard-profile"
import {
  profileInputClass,
  profileLabelClass,
  profilePillButtonClass,
  profileSectionHintClass,
  profileSectionTitleClass,
  profileTextareaClass,
} from "@/components/features/dashboard/profile-settings/profile-settings-styles"

export type ProfileShopTabCopy = {
  displayName: string
  displayNamePlaceholder: string
  username: string
  bio: string
  bioPlaceholder: string
  location: string
  locationPlaceholder: string
  city: string
  cityPlaceholder: string
  banner: string
  bannerHint: string
  changeBanner: string
  removeBanner: string
  uploading: string
  removingBanner: string
  save: string
  saving: string
  saved: string
  seeMyStore: string
  sellerBannerTitle: string
}

interface ProfileShopTabProps {
  profile: DashboardProfileRow
  copy: ProfileShopTabCopy
  sellerStoreHref: string | null
  saving: boolean
  savedFlash: boolean
  uploadingAvatar: boolean
  removingAvatar: boolean
  uploadingBanner: boolean
  removingBanner: boolean
  bannerSavedFlash: boolean
  onProfileChange: (patch: Partial<DashboardProfileRow>) => void
  onSave: () => void
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar: () => void
  onBannerUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveBanner: () => void
}

export function ProfileShopTab({
  profile,
  copy,
  sellerStoreHref,
  saving,
  savedFlash,
  uploadingAvatar,
  removingAvatar,
  uploadingBanner,
  removingBanner,
  bannerSavedFlash,
  onProfileChange,
  onSave,
  onAvatarUpload,
  onRemoveAvatar,
  onBannerUpload,
  onRemoveBanner,
}: ProfileShopTabProps) {
  const username = profile.seller_slug?.trim() || "—"

  return (
    <div className="mx-auto max-w-xl space-y-8 pt-2">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className="h-24 w-24 border-2 border-neutral-200 bg-neutral-100">
            <AvatarImage
              src={profile.avatar_url ? profileMediaDisplaySrc(profile.avatar_url) : undefined}
              alt={profile.display_name}
            />
            <AvatarFallback className="bg-neutral-100">
              <User className="h-10 w-10 text-primary/70" aria-hidden />
            </AvatarFallback>
          </Avatar>
          <label
            htmlFor="shop-avatar-upload"
            className={cn(
              "absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm",
              (uploadingAvatar || removingAvatar) && "pointer-events-none opacity-60",
            )}
          >
            {uploadingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin text-foreground" aria-hidden />
            ) : (
              <Pencil className="h-3.5 w-3.5 text-foreground" aria-hidden />
            )}
          </label>
          <input
            id="shop-avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            className="hidden"
            onChange={onAvatarUpload}
            disabled={uploadingAvatar || removingAvatar}
          />
        </div>
        {profile.avatar_url ? (
          <button
            type="button"
            onClick={onRemoveAvatar}
            disabled={uploadingAvatar || removingAvatar}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-60"
          >
            {removingAvatar ? "Removing…" : "Remove photo"}
          </button>
        ) : null}
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="shop-display-name" className={profileLabelClass}>
              {copy.displayName}
            </Label>
            {sellerStoreHref ? (
              <Link
                href={sellerStoreHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {copy.seeMyStore}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          <Input
            id="shop-display-name"
            className={profileInputClass}
            value={profile.display_name || ""}
            onChange={(e) => onProfileChange({ display_name: e.target.value })}
            placeholder={copy.displayNamePlaceholder}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-username" className={profileLabelClass}>
            {copy.username}
          </Label>
          <Input id="shop-username" className={cn(profileInputClass, "bg-neutral-50")} value={username} readOnly disabled />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shop-bio" className={profileLabelClass}>
            {copy.bio}
          </Label>
          <Textarea
            id="shop-bio"
            className={profileTextareaClass}
            value={profile.bio || ""}
            onChange={(e) => onProfileChange({ bio: e.target.value })}
            placeholder={copy.bioPlaceholder}
            rows={4}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shop-location" className={profileLabelClass}>
              {copy.location}
            </Label>
            <Input
              id="shop-location"
              className={profileInputClass}
              value={profile.location || ""}
              onChange={(e) => onProfileChange({ location: e.target.value })}
              placeholder={copy.locationPlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shop-city" className={profileLabelClass}>
              {copy.city}
            </Label>
            <Input
              id="shop-city"
              className={profileInputClass}
              value={profile.city || ""}
              onChange={(e) => onProfileChange({ city: e.target.value })}
              placeholder={copy.cityPlaceholder}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-neutral-200/80 pt-6">
        <div>
          <p className={profileSectionTitleClass}>{copy.sellerBannerTitle}</p>
          <p className={cn(profileSectionHintClass, "mt-1")}>{copy.bannerHint}</p>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-neutral-200">
          <div
            className="relative aspect-[4/1] w-full min-h-[88px]"
            style={
              profile.shop_banner_url?.trim() ? undefined : { backgroundColor: SELLER_PROFILE_BANNER_DEFAULT }
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
              htmlFor="shop-banner-upload"
              className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100"
            >
              {uploadingBanner ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
              ) : (
                <ImageIcon className="h-6 w-6 text-white" aria-hidden />
              )}
            </label>
            <input
              id="shop-banner-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={onBannerUpload}
              disabled={uploadingBanner || removingBanner}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {bannerSavedFlash ? <span className="font-medium text-emerald-600">Updated</span> : null}
          <label
            htmlFor="shop-banner-upload"
            className={cn(
              "cursor-pointer font-medium text-primary hover:underline",
              (uploadingBanner || removingBanner) && "pointer-events-none opacity-60",
            )}
          >
            {uploadingBanner ? copy.uploading : copy.changeBanner}
          </label>
          {profile.shop_banner_url ? (
            <button
              type="button"
              onClick={onRemoveBanner}
              disabled={uploadingBanner || removingBanner}
              className="font-medium text-muted-foreground hover:text-destructive hover:underline disabled:opacity-60"
            >
              {removingBanner ? copy.removingBanner : copy.removeBanner}
            </button>
          ) : null}
        </div>
      </div>

      <Button
        className={profilePillButtonClass(saving || savedFlash)}
        onClick={onSave}
        disabled={saving || savedFlash}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            {copy.saving}
          </>
        ) : savedFlash ? (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden />
            {copy.saved}
          </>
        ) : (
          copy.save
        )}
      </Button>
    </div>
  )
}
