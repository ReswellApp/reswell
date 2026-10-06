import { ExternalLink } from "lucide-react"
import {
  SURFBOARD_BOX_SOURCES,
  SURFBOARD_BOX_WHOLESALER,
} from "@/lib/seller-resources-surfboard-boxes"

export function SurfboardBoxSources() {
  return (
    <>
      <ul className="grid gap-5">
        {SURFBOARD_BOX_SOURCES.map((source) => (
          <li key={source.id} className="rounded-[1.75rem] bg-white px-6 py-8 ring-1 ring-border">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5574AD]">
              {source.fit}
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-[#001A4A]">{source.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5c6b89] sm:text-base">{source.summary}</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#5c6b89]">
              {source.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            {source.href && source.cta ? (
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#001A4A] underline underline-offset-2"
              >
                {source.cta}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#5c6b89]">
        Packaging wholesalers such as{" "}
        <a
          href={SURFBOARD_BOX_WHOLESALER.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#001A4A] underline underline-offset-2"
        >
          {SURFBOARD_BOX_WHOLESALER.name}
        </a>{" "}
        {SURFBOARD_BOX_WHOLESALER.note}
      </p>
    </>
  )
}
