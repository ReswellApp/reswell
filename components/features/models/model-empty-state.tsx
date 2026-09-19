import { SaveEntitySearchCta } from "@/components/features/saved-search/save-entity-search-cta"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelEmptyState({
  modelName,
  brandName,
  criteria,
  isLoggedIn,
  initialSavedSearchId,
}: {
  modelName: string
  brandName: string
  criteria: BoardSavedSearchCriteria
  isLoggedIn: boolean
  initialSavedSearchId: string | null
}) {
  return (
    <SaveEntitySearchCta
      heading="We currently don't have this model on the site"
      description={`Save this model and we'll email you when a ${brandName} ${modelName} pops up on Reswell.`}
      criteria={criteria}
      label="Save this model"
      savedLabel="Model saved"
      savedSearchLabel={`${brandName} ${modelName}`}
      successTitle="Model saved"
      successDescription={`We'll email you when a ${brandName} ${modelName} is listed on Reswell.`}
      isLoggedIn={isLoggedIn}
      initialSavedSearchId={initialSavedSearchId}
    />
  )
}
