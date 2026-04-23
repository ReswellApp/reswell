"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RequestBrandDialog } from "@/components/request-brand-dialog"
import { SearchInputWithSuggest } from "@/components/search-input-with-suggest"
import { SITE_SEARCH_SHELL_CLASS, siteSearchInputClassName } from "@/components/site-search-bar"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

type BrandInputWithSuggestionsProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Show helper text under the field (default true). */
  showHint?: boolean
  /** Show the “Brand not listed? Request we add it” link (default true). */
  showRequestBrandCta?: boolean
  onBrandRequestSubmitted?: () => void
  /**
   * When the user picks a row from the directory dropdown (links `brand_id` to `public.brands`).
   * Free-typed text does not call this.
   */
  onCatalogBrandPicked?: (b: { id: string; name: string; slug: string }) => void
}

/**
 * Nav-style typeahead: same portaled search UI as the header; brand rows come from `public.brands`
 * (Elasticsearch + hydrate when the cluster is configured, otherwise Supabase). Free text is allowed; “request a brand”
 * covers gaps.
 */
export function BrandInputWithSuggestions({
  id,
  value,
  onChange,
  placeholder = "e.g., Channel Islands",
  className,
  disabled,
  showHint = true,
  showRequestBrandCta = true,
  onBrandRequestSubmitted,
  onCatalogBrandPicked,
}: BrandInputWithSuggestionsProps) {
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestSeedName, setRequestSeedName] = useState("")
  const [settled, setSettled] = useState<{ q: string; count: number } | null>(null)

  const q = value.trim()
  const noDirectoryMatchForQuery =
    settled !== null &&
    settled.count === 0 &&
    settled.q.length > 0 &&
    q === settled.q

  function openRequestDialog(seed: string) {
    setRequestSeedName(seed)
    setRequestOpen(true)
  }

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          SITE_SEARCH_SHELL_CLASS,
          "items-stretch gap-0.5 pl-1.5 pr-1.5",
          "focus-within:border-foreground/25 focus-within:ring-foreground/10",
        )}
      >
        <div className="relative min-w-0 flex-1">
          <SearchInputWithSuggest
            id={id}
            suggestSource="brands"
            name={`brand-elastic-${id}`}
            listboxId={`${id}-suggestions-listbox`}
            value={value}
            onChange={onChange}
            onCatalogBrandPicked={onCatalogBrandPicked}
            onBrandsSearchSettled={(searchQ, count) => {
              setSettled({ q: searchQ, count })
            }}
            minLength={1}
            inputType="text"
            disabled={disabled}
            disableSuggest={disabled}
            showClearButton
            placeholder={placeholder}
            inputClassName={cn(
              "rounded-full pl-1.5 pr-0 text-sm",
              siteSearchInputClassName({ compact: true }),
              "placeholder:text-muted-foreground/50",
              className,
            )}
            className="w-full"
            autoOpenDropdownOnFetch
            showTypeLabels={false}
          />
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="You can link a brand from our directory or type any shaper or label."
          onMouseDown={(e) => e.preventDefault()}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {noDirectoryMatchForQuery ? (
        <div
          role="region"
          aria-label="Brand directory"
          className="rounded-md border border-border/80 bg-card px-3 py-3 text-sm text-muted-foreground shadow-sm"
        >
          <p className="text-sm">No brand in our directory matches &quot;{q}&quot;.</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3 w-full min-h-touch"
            onClick={() => openRequestDialog(q)}
          >
            Request we add this brand
          </Button>
        </div>
      ) : null}

      {showHint ? (
        <p className="text-xs text-muted-foreground">
          Suggestions from our brand list — you can enter any brand; nothing has to match exactly.
        </p>
      ) : null}
      {showRequestBrandCta ? (
        <button
          type="button"
          className="text-xs text-primary underline-offset-4 hover:underline"
          onClick={() => openRequestDialog(value.trim())}
        >
          Brand not listed? Request we add it
        </button>
      ) : null}

      <RequestBrandDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        defaultName={requestSeedName}
        onSubmitted={onBrandRequestSubmitted}
      />
    </div>
  )
}
