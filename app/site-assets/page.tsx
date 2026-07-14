import { redirect } from "next/navigation"

/** Convenience alias — the inventory lives under admin. */
export default function SiteAssetsRedirectPage() {
  redirect("/admin/site-assets")
}
