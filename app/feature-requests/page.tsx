import { FeatureRequestList } from "@/components/features/feature-requests/feature-request-list"
import { FeatureRequestShell } from "@/components/features/feature-requests/feature-request-shell"
import { FeatureRequestToolbar } from "@/components/features/feature-requests/feature-request-toolbar"
import { loadFeatureRequestBoard } from "@/lib/services/featureRequests"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { parseFeatureRequestBoardQuery } from "@/lib/utils/feature-requests"

export async function generateMetadata() {
  return resolvePageMetadata("feature-requests")
}

export default async function FeatureRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  let board
  try {
    board = await loadFeatureRequestBoard(raw)
  } catch (error) {
    console.error("[feature-requests] page:", error instanceof Error ? error.message : "unknown")
    board = {
      query: parseFeatureRequestBoardQuery(raw),
      requests: [],
      total: 0,
      viewer: null,
      degraded: true,
    }
  }

  return (
    <main className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <FeatureRequestShell active="board" />
        <FeatureRequestToolbar query={board.query} total={board.total} />
        <div className="mt-4">
          <FeatureRequestList board={board} />
        </div>
      </div>
    </main>
  )
}
