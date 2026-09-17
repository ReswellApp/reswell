import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { SANTA_BARBARA_DROPOFF_HREF } from "@/lib/dropoff-santa-barbara"

export function SantaBarbaraDropoffPromo() {
  return (
    <Link
      href={SANTA_BARBARA_DROPOFF_HREF}
      className="mb-6 flex items-start gap-3 rounded-[1.25rem] border border-[#001A4A]/10 bg-[#F4F7FB] px-4 py-4 transition-colors hover:bg-[#eef2f8] sm:items-center sm:px-5"
    >
      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#5574AD] sm:mt-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#001A4A]">
          Selling in Santa Barbara? Drop it off — we pack and ship.
        </p>
        <p className="mt-0.5 text-sm leading-snug text-[#5c6b89]">
          If a board hasn&apos;t sold locally, shipping from here reaches buyers nationwide.
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#001A4A]">
        How it works
        <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  )
}
