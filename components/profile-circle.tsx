import Image from "next/image"
import { ProfileAvatarImage } from "@/components/features/dashboard/profile-avatar-image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  profileCircleSrc,
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
  const src = profileCircleSrc(avatarUrl)

  return (
    <Avatar
      className={cn(
        "h-10 w-10 shrink-0 border border-border/80 bg-[#E8F0FA] shadow-sm",
        className,
      )}
    >
      {userPhoto ? (
        <ProfileAvatarImage avatarUrl={avatarUrl} focalX={focalX} focalY={focalY} alt={alt} />
      ) : (
        <AvatarImage src={src} alt={alt} className="object-cover" />
      )}
      <ProfileCircleFallback />
    </Avatar>
  )
}
