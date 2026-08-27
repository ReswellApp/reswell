import Link from "next/link"
import { cn } from "@/lib/utils"
import type { ListingBoardSpecRow } from "@/lib/utils/listing-board-spec-rows"

interface ListingBoardSpecTableProps {
  rows: ListingBoardSpecRow[]
  className?: string
}

export function ListingBoardSpecTable({ rows, className }: ListingBoardSpecTableProps) {
  if (rows.length === 0) return null

  return (
    <dl
      className={cn(
        "border-y border-neutral-200/90 divide-y divide-neutral-200/90 dark:border-neutral-700/70 dark:divide-neutral-700/70",
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[minmax(7.25rem,38%)_minmax(0,1fr)] items-baseline gap-x-4 py-2"
        >
          <dt className="text-[13px] font-medium text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 text-[13px] leading-snug text-foreground tabular-nums">
            {row.href ? (
              <Link href={row.href} className="underline-offset-4 hover:underline">
                {row.value}
              </Link>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
