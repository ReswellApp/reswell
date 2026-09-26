import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { FeatureRequestDetailView } from "@/components/features/feature-requests/feature-request-detail-view"
import { loadFeatureRequestDetail, loadFeatureRequestTitle } from "@/lib/services/featureRequests"
import { featureRequestExcerpt, featureRequestPath, parseFeatureRequestNumberParam } from "@/lib/utils/feature-requests"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>
}): Promise<Metadata> {
  const { number: raw } = await params
  const number = parseFeatureRequestNumberParam(raw)
  if (number == null) return { title: "Feature request — Reswell" }

  try {
    const summary = await loadFeatureRequestTitle(number)
    if (!summary) return { title: "Feature request — Reswell" }
    const description = featureRequestExcerpt(summary.body, 160)
    return {
      title: `${summary.title} — Feature requests — Reswell`,
      description,
      alternates: { canonical: featureRequestPath(number) },
    }
  } catch (error) {
    console.error("[feature-requests] metadata:", error instanceof Error ? error.message : "unknown")
    return { title: "Feature request — Reswell" }
  }
}

export default async function FeatureRequestDetailPage({
  params,
}: {
  params: Promise<{ number: string }>
}) {
  const { number: raw } = await params
  const number = parseFeatureRequestNumberParam(raw)
  if (number == null) notFound()

  let result
  try {
    result = await loadFeatureRequestDetail(number)
  } catch (error) {
    console.error("[feature-requests] detail:", error instanceof Error ? error.message : "unknown")
    return (
      <main className="flex-1 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-600">
          This idea is unavailable right now. Try again in a moment.
        </div>
      </main>
    )
  }

  if (!result.detail) {
    if (result.degraded) {
      return (
        <main className="flex-1 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-neutral-600">
            This idea is unavailable right now. Try again in a moment.
          </div>
        </main>
      )
    }
    notFound()
  }

  return <FeatureRequestDetailView detail={result.detail} viewer={result.viewer} />
}
