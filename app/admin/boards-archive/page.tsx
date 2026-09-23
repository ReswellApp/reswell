import Link from "next/link"
import { redirect } from "next/navigation"
import { BoardArchiveTable } from "@/components/features/admin/board-archive-table"
import { getBoardArchivePage } from "@/lib/services/boardArchive"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Boards archive — Admin — Reswell",
  description: "Every surfboard stored in the Reswell boards archive.",
  path: "/admin/boards-archive",
})

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (page > 1) params.set("page", String(page))
  const search = params.toString()
  return search ? `/admin/boards-archive?${search}` : "/admin/boards-archive"
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export default async function AdminBoardsArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/admin/boards-archive")
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Boards archive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Surfboards that have been listed with a directory brand and model.
        </p>
      </div>

      <form action="/admin/boards-archive" className="flex flex-col gap-2 sm:flex-row">
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
