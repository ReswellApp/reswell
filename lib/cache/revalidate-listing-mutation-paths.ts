import { after } from "next/server"
import { revalidatePath } from "next/cache"

/**
 * Revalidate browse + listing PDP after the Server Action response is sent.
 * Inline `revalidatePath` keeps the action pending; combined with client
 * navigation to `/l/[listing]` that freezes the sell form on Save.
 */
export function revalidateListingMutationPaths(browsePath: string, slug: string): void {
  const trimmed = slug.trim()
  after(() => {
    revalidatePath(browsePath)
    if (trimmed) revalidatePath(`/l/${trimmed}`)
  })
}
