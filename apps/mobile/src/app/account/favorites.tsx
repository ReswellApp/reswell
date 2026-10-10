import { Redirect } from "expo-router"

/** The favorites tab owns this list. Keep the old account path pointed at it. */
export default function AccountFavoritesRedirect() {
  return <Redirect href="/favorites" />
}
