import type { ReactNode } from "react"
import Link from "next/link"
import type { UserSupportCaseListItem } from "@/lib/types/supportCase"
import {
  isSupportCaseOpen,
  SUPPORT_CASE_STATUS_LABEL,
} from "@/lib/utils/support-case-display"
import { LocalDateOnly } from "@/components/ui/local-datetime"
import { SupportCurrentRequest, SupportEmptyRequest } from "@/components/features/dashboard/support/support-current-request"

interface SupportCasesListProps {
  cases: UserSupportCaseListItem[]
  historyOpen?: boolean
  showCurrent?: boolean
}

function partitionCases(cases: UserSupportCaseListItem[]) {
  const open: UserSupportCaseListItem[] = []
  const closed: UserSupportCaseListItem[] = []
  for (const item of cases) {
    if (isSupportCaseOpen(item.status)) open.push(item)
    else closed.push(item)
  }
  const waiting = open.find((item) => item.status === "waiting_on_you")
  const current = waiting ?? open[0] ?? null
  const otherOpen = current ? open.filter((item) => item.id !== current.id) : open
  return { current, otherOpen, closed }
}

function HistoryRow({
  item,
  showStatus = false,
}: {
  item: UserSupportCaseListItem
  showStatus?: boolean
}) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-baseline justify-between gap-3 rounded-xl py-3 transition-colors hover:bg-muted/40 sm:-mx-2 sm:px-2"
      >
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-foreground">{item.subject}</p>
          {showStatus ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {SUPPORT_CASE_STATUS_LABEL[item.status]}
            </p>
          ) : null}
        </div>
        <LocalDateOnly
          iso={item.updatedAt}
          dateStyle="medium"
          className="shrink-0 text-[12px] text-muted-foreground"
        />
      </Link>
    </li>
  )
}

function CaseDrawer({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details className="group" defaultOpen={defaultOpen}>
      <summary className="cursor-pointer list-none rounded-lg py-1 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <span>{title}</span>
          <span className="tabular-nums">
            {count}
            <span className="ml-2 group-open:hidden" aria-hidden>
              +
            </span>
            <span className="ml-2 hidden group-open:inline" aria-hidden>
              –
            </span>
          </span>
        </span>
      </summary>
      <ul className="mt-1 divide-y divide-border/40">{children}</ul>
    </details>
  )
}

export function SupportCasesList({
  cases,
  historyOpen = false,
  showCurrent = true,
}: SupportCasesListProps) {
  const { current, otherOpen, closed } = partitionCases(cases)
  const showPastOpen = historyOpen || !current

  return (
    <div className="space-y-8">
      {showCurrent ? (
        current ? <SupportCurrentRequest item={current} /> : <SupportEmptyRequest />
      ) : null}

      {otherOpen.length > 0 || closed.length > 0 ? (
        <div className="space-y-4 border-t border-border/50 pt-6">
          {otherOpen.length > 0 ? (
            <CaseDrawer title="Other open requests" count={otherOpen.length}>
              {otherOpen.map((item) => (
                <HistoryRow key={`${item.backend}-${item.id}`} item={item} showStatus />
              ))}
            </CaseDrawer>
          ) : null}

          {closed.length > 0 ? (
            <CaseDrawer title="Past conversations" count={closed.length} defaultOpen={showPastOpen}>
              {closed.map((item) => (
                <HistoryRow key={`${item.backend}-${item.id}`} item={item} />
              ))}
            </CaseDrawer>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
