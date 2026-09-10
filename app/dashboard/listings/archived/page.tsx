import { redirect } from "next/navigation"

export default function ArchivedListingsRedirectPage() {
  redirect("/dashboard/listings")
}
