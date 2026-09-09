import { redirect } from "next/navigation"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { HelpHubClient } from "@/components/features/support/help-hub-client"

export async function generateMetadata() {
  return resolvePageMetadata("support")
}

export default async function SupportHubPage() {
  const { user } = await getCachedDashboardSession()
  if (user) {
    redirect("/dashboard/support")
  }

  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 xl:max-w-4xl">
        <HelpHubClient orders={[]} userId="" signedIn={false} />
      </div>
    </main>
  )
}
