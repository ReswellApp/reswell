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
  if (!hasCriteria) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a brand, size, style, or price — then save it as an alert.
      </p>
    )
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        This search
      </p>
      <p className="mt-1 font-headline text-xl font-semibold tracking-tight text-[#001A4A]">
        {title}
      </p>
      {detail && detail !== title ? (
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      ) : null}
      <p className="mt-2 text-sm text-muted-foreground">
        {emailOptIn ? "Email when a match lists." : "Saved without email."}
      </p>
    </div>
  )
}
