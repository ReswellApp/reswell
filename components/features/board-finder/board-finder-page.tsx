"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, Compass, Sparkles } from "lucide-react"

import { useSignInGate } from "@/components/auth/use-sign-in-gate"
import { BoardFinderForm } from "@/components/features/board-finder/board-finder-form"
import { BoardFinderPreviewTicket } from "@/components/features/board-finder/board-finder-preview-ticket"
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
  const [catalogBrandId, setCatalogBrandId] = useState("")
  const [model, setModel] = useState("")
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

  const criteria = useMemo(
    () =>
      boardSavedSearchCriteriaFromFilters({
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
      }),
    [brand, model, catalogBrandId, catalogBrandModelId, minPrice, maxPrice, facets],
  )

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
        title: "Give us a clue",
        description: "Brand, size, style, or a price range — anything we can watch for.",
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
      title: emailOptIn ? "We’re watching the lineup" : "Search saved",
      description: emailOptIn
        ? "You’ll get an email the moment a matching board lists."
        : "Open it anytime on /boards.",
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
    toast({ title: "Off the watch list" })
    await refreshSavedSearches()
  }

  return (
    <main className="flex-1 bg-[#F4F7FB]">
      <section className="border-b border-[#001A4A]/10">
        <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#5574AD]">
            Board Finder
          </p>
          <h1 className="mt-3 max-w-xl font-headline text-4xl font-bold tracking-tight text-[#001A4A] sm:text-5xl">
            Name the board. We’ll hunt the lineup.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-[#5c6b89] sm:text-lg">
            Build a ticket for the board you want. Save up to {BOARD_SAVED_SEARCHES_MAX} watches and
            we’ll email you when it lists — nationwide.
          </p>
          <ul className="mt-6 flex flex-wrap gap-4 text-sm text-[#001A4A]">
            <li className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#5574AD]" aria-hidden />
              As specific as you like
            </li>
            <li className="inline-flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#5574AD]" aria-hidden />
              Alert when it pops
            </li>
            <li className="inline-flex items-center gap-2">
              <Compass className="h-4 w-4 text-[#5574AD]" aria-hidden />
              Shop it live anytime
            </li>
          </ul>
        </div>
      </section>

      <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
          <section className="rounded-[1.75rem] border border-[#001A4A]/10 bg-white p-5 shadow-[0_18px_50px_-28px_rgba(0,26,74,0.35)] sm:p-8">
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
                setCatalogBrandId("")
                setCatalogBrandModelId("")
              }}
              onCatalogBrandPicked={(b) => {
                setBrand(b.name)
                setCatalogBrandId(b.id)
                setCatalogBrandModelId("")
              }}
              onModelTextChange={(next) => {
                setModel(next)
                setCatalogBrandModelId("")
              }}
              onCatalogModelPicked={(row) => {
                setModel(row.name)
                setCatalogBrandModelId(row.id)
                if (row.brandId) {
                  setCatalogBrandId(row.brandId)
                  setBrand(row.brandName)
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

          <aside className="space-y-6 lg:sticky lg:top-24">
            <BoardFinderPreviewTicket
              title={ticketTitle}
              detail={canSave ? summary : ""}
              hasCriteria={canSave}
              emailOptIn={emailOptIn}
            />
            <BoardFinderSavedList
              savedSearches={savedSearches}
              savedLoading={savedLoading}
              deletingId={deletingId}
              onDelete={(id) => void handleDelete(id)}
            />
          </aside>
        </div>

        <p className="mt-12 text-center text-sm text-[#5c6b89]">
          Already listed?{" "}
          <Link
            href="/boards"
            className="font-semibold text-[#001A4A] underline underline-offset-4"
          >
            Shop boards
          </Link>
        </p>
      </div>
    </main>
  )
}
