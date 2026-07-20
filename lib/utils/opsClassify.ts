import type { OpsGroupRow, OpsSource } from "@/lib/types/ops"

/** Dashboard views — React is a slice of client errors, not a DB source. */
export type OpsView = "overview" | "vercel" | "supabase" | "client" | "react" | "server"

export const OPS_VIEWS: readonly OpsView[] = [
  "overview",
  "vercel",
  "supabase",
  "client",
  "react",
  "server",
] as const

export function isOpsView(value: string): value is OpsView {
  return (OPS_VIEWS as readonly string[]).includes(value)
}

/** Detect React runtime / hydration / minified production errors. */
export function isReactOpsError(input: {
  category?: string | null
  title?: string | null
  message?: string | null
  stack_sample?: string | null
}): boolean {
  if (input.category === "react") return true

  const blob = [input.title, input.message, input.stack_sample]
    .filter(Boolean)
    .join("\n")
    .toLowerCase()

  if (!blob) return false

  return (
    blob.includes("minified react error") ||
    blob.includes("react.dev/errors") ||
    blob.includes("reactjs.org/docs/error-decoder") ||
    /react error #\d+/.test(blob) ||
    blob.includes("hydration failed") ||
    blob.includes("text content does not match server-rendered html") ||
    blob.includes("there was an error while hydrating") ||
    (blob.includes("react-dom") && (blob.includes("error") || blob.includes("exception")))
  )
}

export function opsViewFromSource(source: OpsSource, row?: Pick<OpsGroupRow, "category" | "title" | "message" | "stack_sample">): OpsView {
  if (source === "client" && row && isReactOpsError(row)) return "react"
  if (source === "client") return "client"
  if (source === "vercel") return "vercel"
  if (source === "supabase") return "supabase"
  return "server"
}

export function filterOpsGroupsByView(rows: OpsGroupRow[], view: OpsView): OpsGroupRow[] {
  if (view === "overview") return rows
  if (view === "react") {
    return rows.filter((row) => row.source === "client" && isReactOpsError(row))
  }
  if (view === "client") {
    return rows.filter((row) => row.source === "client" && !isReactOpsError(row))
  }
  return rows.filter((row) => row.source === view)
}

export type OpsViewCounts = Record<OpsView, number>

export function emptyOpsViewCounts(): OpsViewCounts {
  return {
    overview: 0,
    vercel: 0,
    supabase: 0,
    client: 0,
    react: 0,
    server: 0,
  }
}

export function countOpsGroupsByView(rows: OpsGroupRow[]): OpsViewCounts {
  const counts = emptyOpsViewCounts()
  for (const row of rows) {
    counts.overview += 1
    const view = opsViewFromSource(row.source, row)
    counts[view] += 1
  }
  return counts
}
