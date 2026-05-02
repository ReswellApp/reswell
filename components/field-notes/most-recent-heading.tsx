type Props = {
  id: string
}

/**
 * Section title: first word + hairline extending after the second word.
 */
export function MostRecentHeading({ id }: Props) {
  return (
    <div className="mb-12 sm:mb-14">
      <h2
        id={id}
        className="flex flex-wrap items-baseline gap-x-0 text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
      >
        <span className="inline-block pr-[0.15em]">Most</span>
        <span className="relative inline-flex min-w-0 flex-1 items-baseline gap-x-3 pb-1 sm:gap-x-4">
          <span>Recent</span>
          <span
            className="relative top-[2px] h-px min-w-[3rem] flex-1 bg-border sm:top-1 sm:min-w-[6rem]"
            aria-hidden
          />
        </span>
      </h2>
    </div>
  )
}
