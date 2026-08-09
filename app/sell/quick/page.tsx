import { redirect } from "next/navigation"

/**
 * Quick List is retired for now — send everyone to the full board wizard.
 * Keep this route so old bookmarks / in-flight tabs still land somewhere useful.
 */
export default async function QuickListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const qs = await searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(qs)) {
    if (typeof value === "string" && value) params.set(key, value)
    else if (Array.isArray(value) && typeof value[0] === "string" && value[0]) {
      params.set(key, value[0])
    }
  }
  if (!params.has("new")) params.set("new", "1")
  const query = params.toString()
  redirect(query ? `/sell/boards?${query}` : "/sell/boards?new=1")
}
