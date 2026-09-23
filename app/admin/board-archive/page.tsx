import Link from "next/link"
import { redirect } from "next/navigation"
import { BoardArchiveTable } from "@/components/features/admin/board-archive-table"
import { getBoardArchivePage } from "@/lib/services/boardArchive"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Boards catalog — Admin — Reswell",
  description:
    "Every surfboard that has circulated on Reswell with a directory brand and model, kept for the future image catalog.",
  path: "/admin/board-archive",
})

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  const search = params.toString()
  return search ? `/admin/board-archive?${search}` : "/admin/board-archive"
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export default async function AdminBoardArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/board-archive")
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  if (!profile?.is_admin) {
    redirect("/admin")
  }

  const params = await searchParams
  const page = parsePage(params.page)
  const archive = await getBoardArchivePage(supabase, { page, query: params.q })
  const pageCount = Math.max(1, Math.ceil(archive.total / archive.pageSize))
  const from = archive.rows.length === 0 ? 0 : (archive.page - 1) * archive.pageSize + 1
  const to = from === 0 ? 0 : from + archive.rows.length - 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Boards catalog</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Actual surfboards that have been listed on Reswell. Each row is one listing tagged with a
          directory brand and model, the listing dimensions, every listing photo, and the catalog size when the measurements
          match a single variant. This is the archive image matching will use later.
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Boards</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{archive.catalogTotal}</dd>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Size matched</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{archive.withVariant}</dd>
        </div>
        <div className="rounded-xl border border-border px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">With photos</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{archive.withPhoto}</dd>
        </div>
      </dl>

      <form action="/admin/board-archive" className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={archive.query}
          aria-label="Search brand, model, or listing title"
          placeholder="Search brand, model, or listing title"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
        />
        <button
          type="submit"
          className="h-10 rounded-md bg-foreground px-4 text-sm font-medium text-background"
        >
          Search
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {archive.query
          ? `Showing ${from}–${to} of ${archive.total} for “${archive.query}”.`
          : `Showing ${from}–${to} of ${archive.total}.`}
      </p>

      <BoardArchiveTable rows={archive.rows} />

      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {archive.page > 1 ? (
            <Link href={pageHref(archive.page - 1, archive.query)} className="hover:underline">
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {archive.page} of {pageCount}
          </span>
          {archive.page < pageCount ? (
            <Link href={pageHref(archive.page + 1, archive.query)} className="hover:underline">
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  )
}
