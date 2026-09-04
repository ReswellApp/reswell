import { Bell } from "lucide-react"

import { cn } from "@/lib/utils"

export function BoardFinderPreviewTicket({
  title,
  detail,
  hasCriteria,
  emailOptIn,
}: {
  title: string
  detail: string
  hasCriteria: boolean
  emailOptIn: boolean
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-[#001A4A]/25 bg-white/90 px-5 py-4 shadow-sm",
        hasCriteria && "border-solid border-[#001A4A]/15",
      )}
    >
      <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#F4F7FB]" />
      <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[#F4F7FB]" />
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#5574AD]">
        {hasCriteria ? (emailOptIn ? "Watching the lineup" : "Saved search") : "Your board ticket"}
      </p>
      <p className="mt-1.5 font-headline text-xl font-bold tracking-tight text-[#001A4A]">
        {hasCriteria ? title : "Start with a brand, size, or style"}
      </p>
      <p className="mt-1 text-sm leading-snug text-[#5c6b89]">
        {hasCriteria ? detail : "We’ll turn this into an alert the second a match lists."}
      </p>
      {hasCriteria && emailOptIn ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#5574AD]">
          <Bell className="h-3.5 w-3.5" aria-hidden />
          Inbox ping when it pops
        </p>
      ) : null}
    </div>
  )
}
