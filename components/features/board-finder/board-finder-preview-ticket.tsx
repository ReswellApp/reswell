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
    <div className="rounded-2xl border border-white/50 bg-white/90 p-4 shadow-[0_10px_30px_-18px_rgba(11,36,48,0.55)] backdrop-blur-md sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#3d6b86]">
        {hasCriteria ? "This search" : "Waiting"}
      </p>
      <p className="mt-2 font-headline text-xl font-semibold tracking-tight text-[#13233f] sm:text-2xl">
        {hasCriteria ? title : "Nothing set yet."}
      </p>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-[#5c6d80]">
        {hasCriteria
          ? detail && detail !== title
            ? detail
            : emailOptIn
              ? "We’ll email you when a match lists."
              : "Saved quietly, without email."
          : "Add a brand, size, style, or price. We’ll turn it into an alert."}
      </p>
      {hasCriteria && detail && detail !== title ? (
        <p className="mt-2 text-sm text-[#5c6d80]">
          {emailOptIn ? "We’ll email you when a match lists." : "Saved quietly, without email."}
        </p>
      ) : null}
    </div>
  )
}
