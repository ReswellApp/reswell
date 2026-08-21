import { redirect } from "next/navigation"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Saved listings — Reswell",
  description: "Your saved surfboard listings on Reswell.",
  path: "/favorites",
  robots: { index: false, follow: false },
})

/** Bookmarks and emails still use `/favorites`; the list now lives in the dashboard. */
export default function FavoritesRedirectPage() {
  redirect("/dashboard/favorites")
}
