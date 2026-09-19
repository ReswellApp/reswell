import { SaveEntitySearchButton } from "@/components/features/saved-search/save-entity-search-button"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function SaveEntitySearchCta({
  heading,
  description,
  criteria,
  label,
  savedLabel,
  savedSearchLabel,
  successTitle,
  successDescription,
  isLoggedIn,
  initialSavedSearchId,
}: {
  heading: string
  description: string
  criteria: BoardSavedSearchCriteria
  label: string
  savedLabel?: string
  savedSearchLabel?: string
  successTitle: string
  successDescription: string
  isLoggedIn: boolean
  initialSavedSearchId?: string | null
}) {
  return (
    <section
      className="rounded-2xl bg-neutral-100 px-6 py-12 text-center sm:px-10 sm:py-16"
      aria-labelledby="save-entity-search-heading"
    >
      <h2
        id="save-entity-search-heading"
        className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {heading}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-foreground/80 sm:text-base">{description}</p>
      <SaveEntitySearchButton
        className="mt-6 bg-background px-5"
        criteria={criteria}
        label={label}
        savedLabel={savedLabel}
        savedSearchLabel={savedSearchLabel}
        successTitle={successTitle}
        successDescription={successDescription}
        isLoggedIn={isLoggedIn}
        initialSavedSearchId={initialSavedSearchId}
      />
    </section>
  )
}
