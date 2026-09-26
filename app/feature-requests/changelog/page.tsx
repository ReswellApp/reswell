import { FeatureRequestChangelogList } from "@/components/features/feature-requests/feature-request-changelog-list"
import { FeatureRequestShell } from "@/components/features/feature-requests/feature-request-shell"
import { loadFeatureRequestChangelog } from "@/lib/services/featureRequests"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("feature-requests-changelog")
}

export default async function FeatureRequestChangelogPage() {
  let board
  try {
    board = await loadFeatureRequestChangelog()
  } catch (error) {
    console.error("[feature-requests] changelog:", error instanceof Error ? error.message : "unknown")
    board = { entries: [], viewer: null, degraded: true }
  }

  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <FeatureRequestShell active="changelog" />
        <FeatureRequestChangelogList board={board} />
      </div>
    </main>
  )
}
