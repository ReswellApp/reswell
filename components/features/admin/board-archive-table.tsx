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
        No boards in the archive yet. A surfboard is added when its listing is published with a
        directory brand and model.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[880px] text-left text-sm">
        <caption className="sr-only">Boards archive</caption>
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Photos</th>
            <th className="px-3 py-2 font-medium">Listing</th>
            <th className="px-3 py-2 font-medium">Brand</th>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-3 py-2 font-medium">Dimensions</th>
            <th className="px-3 py-2 font-medium">Variant</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Added</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2.5">
                {row.photoUrls.length > 0 ? (
                  <div className="flex max-w-[220px] flex-wrap gap-1">
                    {row.photoUrls.map((url, index) => (
                      <Image
                        key={`${row.id}-${index}`}
                        src={url}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-md object-cover"
                        unoptimized={listingImageShouldBypassOptimization(url)}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No photos</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <Link
                  href={row.href}
                  className="font-medium hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.title}
                  <ArrowUpRight className="ml-1 inline h-3 w-3" />
                </Link>
              </td>
              <td className="px-3 py-2.5">{row.brandName}</td>
              <td className="px-3 py-2.5">{row.modelName}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{row.dimensions ?? "—"}</td>
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
