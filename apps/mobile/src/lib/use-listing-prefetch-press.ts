import { prefetchListing } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

/** Start the PDP fetch on finger-down so the listing screen can skip the spinner. */
export function useListingPrefetchPress(item: { id: string; slug: string | null }, onPress: () => void) {
  const { session } = useAuth()
  return {
    onPress,
    onPressIn: () => prefetchListing(item.slug || item.id, session?.access_token),
  }
}
