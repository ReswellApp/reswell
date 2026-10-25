import { ProfileAvatarImage } from "@/components/features/dashboard/profile-avatar-image"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { profileCircleSrc } from "@/lib/profile-circle"
import { cn } from "@/lib/utils"

/** Solid fill. Same blue as an empty seller profile banner (`#5574AD`). */
export function StandardProfileMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("absolute inset-0 bg-[#5574AD]", className)} />
}

export function ProfileCircleFallback({ className }: { className?: string }) {
  return (
    <AvatarFallback className={cn("relative bg-[#5574AD] p-0", className)}>
      <StandardProfileMark />
    </AvatarFallback>
  )
}

/** Same circle as the seller profile: photo with focal crop, or the banner blue. */
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
  const photo = avatarUrl?.trim() ? profileCircleSrc(avatarUrl) : ""

  return (
    <Avatar className={cn("h-10 w-10 shrink-0 border border-border/80 bg-[#5574AD] shadow-sm", className)}>
      {photo ? <ProfileAvatarImage avatarUrl={photo} focalX={focalX} focalY={focalY} alt={alt} /> : null}
      <ProfileCircleFallback />
    </Avatar>
  )
}
