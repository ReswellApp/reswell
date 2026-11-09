import Image from "next/image"
import { ProfileAvatarImage } from "@/components/features/dashboard/profile-avatar-image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  standardProfileAvatarSrc,
  userProfilePhotoDisplaySrc,
} from "@/lib/profile-circle"
import { cn } from "@/lib/utils"

/** Default avatar when a user has no profile photo. */
export function StandardProfileMark({ className }: { className?: string }) {
  return (
    <Image
      aria-hidden
      src={standardProfileAvatarSrc()}
      alt=""
      fill
      sizes="96px"
      className={cn("object-cover", className)}
    />
  )
}

export function ProfileCircleFallback({ className }: { className?: string }) {
  return (
    <AvatarFallback className={cn("relative overflow-hidden bg-[#E8F0FA] p-0", className)}>
      <StandardProfileMark />
    </AvatarFallback>
  )
}

/**
 * Radix AvatarFallback for profile circles.
 * When a user photo URL is present, use a neutral fill while it loads so the
 * Reswell default mark does not flash before the real image.
 * When there is no photo (or load failed), show the standard mark.
 */
export function ProfileCircleSlotFallback({
  hasPhoto,
  className,
}: {
  hasPhoto: boolean
  className?: string
}) {
  if (!hasPhoto) {
    return <ProfileCircleFallback className={className} />
  }
  return <AvatarFallback className={cn("bg-[#E8F0FA]", className)} />
}

/** Same circle as the seller profile: photo with focal crop, or the default avatar. */
export function ProfileCircle({
  avatarUrl,
  focalX,
  focalY,
  alt = "",
  className,
}: {
  avatarUrl?: string | null
  focalX?: number | null
  focalY?: number | null
  alt?: string
  className?: string
}) {
  const userPhoto = userProfilePhotoDisplaySrc(avatarUrl)

  return (
    <Avatar
      className={cn(
        "h-10 w-10 shrink-0 border border-border/80 bg-[#E8F0FA] shadow-sm",
        className,
      )}
    >
      {userPhoto ? (
        <ProfileAvatarImage avatarUrl={avatarUrl} focalX={focalX} focalY={focalY} alt={alt} />
      ) : null}
      <ProfileCircleSlotFallback hasPhoto={Boolean(userPhoto)} />
    </Avatar>
  )
}
