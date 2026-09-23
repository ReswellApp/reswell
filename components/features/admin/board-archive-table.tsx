import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import type { BoardArchiveRow } from "@/lib/types/board-archive"

function addedLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function BoardArchiveTable({ rows }: { rows: BoardArchiveRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No boards match this view yet. A surfboard is added when its listing is published with a
        directory brand and model.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">Surfboards in the Reswell boards catalog</caption>
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Board</th>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Variant</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {row.thumbnailUrl ? (
                    <Image
                      src={row.thumbnailUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-md object-cover"
                      unoptimized={listingImageShouldBypassOptimization(row.thumbnailUrl)}
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0">
                    <Link
                      href={row.href}
                      className="font-medium hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.title}
                      <ArrowUpRight className="ml-1 inline h-3 w-3" />
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {[row.priceLabel, row.dimensions].filter(Boolean).join(" · ") || "No size on listing"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5">{row.brandName}</td>
              <td className="px-3 py-2.5">{row.modelName}</td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {row.variantSummary ?? "Not matched"}
              </td>
              <td className="px-3 py-2.5">{row.statusLabel}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{addedLabel(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
