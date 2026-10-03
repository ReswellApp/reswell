"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { BoardFinderAtmosphere } from "@/components/features/board-finder/board-finder-atmosphere"
import { BoardFinderForm } from "@/components/features/board-finder/board-finder-form"
import { BoardFinderSavedList } from "@/components/features/board-finder/board-finder-saved-list"
import { useToast } from "@/hooks/use-toast"
import {
  createBoardSavedSearchAction,
  deleteBoardSavedSearchAction,
  listBoardSavedSearchesAction,
  type BoardSavedSearchListItem,
} from "@/lib/actions/boardSavedSearch"
import type { BoardsBrowseFacetSelections } from "@/lib/boards-browse-facets"
import { createClient } from "@/lib/supabase/client"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"
import { boardSavedSearchCriteriaFromFilters } from "@/lib/utils/board-saved-search-criteria"
import { boardSavedSearchCriteriaSummary } from "@/lib/utils/board-saved-search-browse-url"
import {
  BOARD_SAVED_SEARCHES_MAX,
  boardSavedCriteriaHasSpecificity,
} from "@/lib/validations/boardSavedSearch"

const ANY = "any"

function emptyFacets(): BoardsBrowseFacetSelections {
  return {
    styles: [],
    conditions: [],
    finSetups: [],
    finSystems: [],
    constructions: [],
    lengthBuckets: [],
    volumeBuckets: [],
  }
}

export function BoardFinderPage() {
  const { toast } = useToast()
  const openSignIn = useSignInGate()

  const [brand, setBrand] = useState("")
  const [brandSlug, setBrandSlug] = useState("")
  const [catalogBrandId, setCatalogBrandId] = useState("")
  const [model, setModel] = useState("")
  const [modelSlug, setModelSlug] = useState("")
  const [catalogBrandModelId, setCatalogBrandModelId] = useState("")
  const [style, setStyle] = useState(ANY)
  const [length, setLength] = useState(ANY)
  const [condition, setCondition] = useState(ANY)
  const [minPrice, setMinPrice] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [volume, setVolume] = useState(ANY)
  const [construction, setConstruction] = useState(ANY)
  const [finSystem, setFinSystem] = useState(ANY)
  const [showMore, setShowMore] = useState(false)
  const [emailOptIn, setEmailOptIn] = useState(true)

  const [pending, setPending] = useState(false)
  const [savedSearches, setSavedSearches] = useState<BoardSavedSearchListItem[]>([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isSignedIn, setIsSignedIn] = useState(false)

  const facets = useMemo<BoardsBrowseFacetSelections>(() => {
    const next = emptyFacets()
    if (style !== ANY) next.styles = [style]
    if (condition !== ANY) next.conditions = [condition]
    if (length !== ANY) next.lengthBuckets = [length]
    if (volume !== ANY) next.volumeBuckets = [volume]
    if (construction !== ANY) next.constructions = [construction]
    if (finSystem !== ANY) next.finSystems = [finSystem]
    return next
  }, [style, condition, length, volume, construction, finSystem])

  const criteria = useMemo(() => {
    const snapshot = boardSavedSearchCriteriaFromFilters({
      q: "",
      brand,
      model,
      catalogBrandId,
      catalogBrandModelId,
      boardLength: "",
      boardWidthInches: "",
      boardThicknessInches: "",
      boardVolumeL: "",
      type: "all",
      condition: "all",
      sort: "",
      minPrice,
      maxPrice,
      facets,
    })
    // Keep alertKind as a filtered search so size, style, and price stay on the
    // browse link. Brand and model ids still drive the match.
    return {
      ...snapshot,
      alertKind: "search" as const,
      source: "board-finder" as const,
      ...(brandSlug ? { brandSlug } : {}),
      ...(modelSlug ? { modelSlug } : {}),
    }
  }, [
    brand,
    brandSlug,
    model,
    modelSlug,
    catalogBrandId,
    catalogBrandModelId,
    minPrice,
    maxPrice,
    facets,
  ])

  const canSave = boardSavedCriteriaHasSpecificity(criteria)
  const summary = boardSavedSearchCriteriaSummary(criteria)
  const atSavedLimit = savedSearches.length >= BOARD_SAVED_SEARCHES_MAX
  const ticketTitle = [brand.trim(), model.trim()].filter(Boolean).join(" ") || summary

  const refreshSavedSearches = useCallback(async () => {
    setSavedLoading(true)
    try {
      const res = await listBoardSavedSearchesAction()
      if ("error" in res) {
        setSavedSearches([])
        return
      }
      setSavedSearches(res.data)
    } catch (err) {
      setSavedSearches([])
      if (!isBenignClientFetchError(err)) {
        console.error("Could not load board finder searches:", err)
      }
    } finally {
      setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSignedIn(Boolean(user))
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user))
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshSavedSearches()
  }, [refreshSavedSearches])

  async function handleSave() {
    if (!isSignedIn) {
      openSignIn(undefined, { skipSessionProbe: true })
      return
    }
    if (!canSave) {
      toast({
        title: "Add a filter",
        description: "Brand, size, style, or a price range — something we can match against.",
      })
      return
    }

    setPending(true)
    const res = await createBoardSavedSearchAction({
      criteria,
      emailNotificationsEnabled: emailOptIn,
    })
    setPending(false)
    if ("error" in res) {
      if (res.error === "Sign in to save a search.") {
        openSignIn()
        return
      }
      toast({ title: "Could not save", description: res.error, variant: "destructive" })
      return
    }
    toast({
      title: emailOptIn ? "Alert saved" : "Search saved",
      description: emailOptIn
        ? "We’ll email you when a matching board lists."
        : "Open it anytime from /boards.",
    })
    await refreshSavedSearches()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await deleteBoardSavedSearchAction({ id })
    setDeletingId(null)
    if ("error" in res) {
      toast({ title: "Could not remove", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: "Search removed" })
    await refreshSavedSearches()
  }

  return (
    <main className="flex-1 bg-[#eef3f6]">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[#3d6b86]">
            Board Finder
          </p>
          <h1 className="mt-3 font-headline text-4xl font-semibold tracking-tight text-[#13233f] sm:text-5xl">
            We’ll watch for it.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#5c6d80]">
            Save up to {BOARD_SAVED_SEARCHES_MAX} searches. When a matching board lists, we email
            you.
          </p>
        </div>
        {!savedLoading ? (
          <p className="inline-flex w-fit items-center rounded-full bg-white px-3.5 py-1.5 text-xs tabular-nums text-[#5c6d80] ring-1 ring-[#e3eaef]">
            {savedSearches.length} of {BOARD_SAVED_SEARCHES_MAX} watching
          </p>
        ) : null}
      </header>

      <div className="mt-10 grid items-start gap-8 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:gap-12">
        <section className="order-2 rounded-[1.75rem] border border-[#e3eaef] bg-white px-5 py-6 sm:px-8 sm:py-8 lg:order-1">
          <BoardFinderForm
            brand={brand}
            catalogBrandId={catalogBrandId}
            model={model}
            style={style}
            length={length}
            condition={condition}
            minPrice={minPrice}
            maxPrice={maxPrice}
            volume={volume}
            construction={construction}
            finSystem={finSystem}
            showMore={showMore}
            emailOptIn={emailOptIn}
            pending={pending}
            isSignedIn={isSignedIn}
            atSavedLimit={atSavedLimit}
            canSave={canSave}
            onBrandTextChange={(next) => {
              setBrand(next)
              setBrandSlug("")
              setCatalogBrandId("")
              setModelSlug("")
              setCatalogBrandModelId("")
            }}
            onCatalogBrandPicked={(b) => {
              setBrand(b.name)
              setBrandSlug(b.slug)
              setCatalogBrandId(b.id)
              setModelSlug("")
              setCatalogBrandModelId("")
            }}
            onModelTextChange={(next) => {
              setModel(next)
              setModelSlug("")
              setCatalogBrandModelId("")
            }}
            onCatalogModelPicked={(row) => {
              setModel(row.name)
              setModelSlug(row.catalogSlug)
              setCatalogBrandModelId(row.id)
              if (row.brandId) {
                setCatalogBrandId(row.brandId)
                setBrand(row.brandName)
                setBrandSlug(row.brandSlug)
              }
            }}
            onStyleChange={setStyle}
            onLengthChange={setLength}
            onConditionChange={setCondition}
            onMinPriceChange={setMinPrice}
            onMaxPriceChange={setMaxPrice}
            onVolumeChange={setVolume}
            onConstructionChange={setConstruction}
            onFinSystemChange={setFinSystem}
            onToggleMore={() => setShowMore((v) => !v)}
            onEmailOptInChange={setEmailOptIn}
            onSave={() => void handleSave()}
          />
        </section>

        <BoardFinderAtmosphere
          className="order-1 lg:order-2"
          title={ticketTitle}
          detail={canSave ? summary : ""}
          hasCriteria={canSave}
          emailOptIn={emailOptIn}
        />
      </div>

      <BoardFinderSavedList
        className="mt-8 lg:mt-12"
        savedSearches={savedSearches}
        savedLoading={savedLoading}
        deletingId={deletingId}
        onDelete={(id) => void handleDelete(id)}
      />

      <p className="mt-10 text-sm text-[#5c6d80]">
        Already listed?{" "}
        <Link
          href="/boards"
          className="font-medium text-[#13233f] underline decoration-[#c5d0da] underline-offset-4 hover:decoration-[#13233f]"
        >
          Shop boards
        </Link>
      </p>
      </div>
    </main>
  )
}
