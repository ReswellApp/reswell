import { revalidateTag } from "next/cache"
import { profileBrowseHomeTag } from "@/lib/cache/profile-browse-home"

export function revalidateProfileBrowseHome(userId: string): void {
  const id = userId.trim()
  if (!id) return
  revalidateTag(profileBrowseHomeTag(id), "max")
}
