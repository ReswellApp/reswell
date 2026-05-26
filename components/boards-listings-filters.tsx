"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useTransition, useEffect, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MapPin, LocateFixed } from "lucide-react"
import { BoardsListingsSearchField } from "@/components/boards-listings-search-field"
import {
  SiteSearchFormSubmitButton,
  SiteSearchShell,
  siteFilterSelectTriggerClassName,
  siteSearchInputClassName,
} from "@/components/site-search-bar"
import { LocationInputSuggest } from "@/components/location-input-suggest"
import { prefetchBoardsBrowseBrandModelsCatalog } from "@/components/boards-browse-catalog-brand-model"
import { useToast } from "@/hooks/use-toast"
import { listingConditionFilterRows } from "@/lib/listing-labels"
import { BOARDS_BROWSE_DEFAULT_SORT } from "@/lib/marketplace-slug-metadata"
import { cn } from "@/lib/utils"
import { isUuidString } from "@/lib/utils/isUuid"
import {
  BoardsAdvancedFiltersMobileSlider,
  BoardsAdvancedFiltersPanel,
  BoardsAdvancedFiltersTrigger,
  type BoardsAdvancedFiltersPanelProps,
} from "@/components/boards-advanced-filters-panel"
import type { BoardsBrowseFilterFields } from "@/lib/utils/board-saved-search-criteria"
import {
  hasActiveAdvancedBrowseFilters,
} from "@/lib/utils/board-saved-search-criteria"
import {
  appendBoardDimensionBrowseParams,
} from "@/lib/utils/board-dimension-browse-filter"
import type { BoardDimensionsInputValues } from "@/components/board-dimensions-input-fields"

export const boardTypes = [
  { value: "all", label: "All Board Types" },
  { value: "shortboard", label: "Shortboard" },
  { value: "groveler", label: "Groveler" },
  { value: "hybrid", label: "Hybrid" },
  { value: "longboard", label: "Longboard" },
  { value: "step-up-gun", label: "Step-Up / Gun" },
  { value: "other", label: "Other" },
]

export const boardConditions = [
  { value: "all", label: "Condition Any" },
  ...listingConditionFilterRows(),
]

export const boardSortOptions = [
  { value: BOARDS_BROWSE_DEFAULT_SORT, label: "Newest" },
  { value: "price-newest", label: "Highest price" },
  { value: "price-low", label: "Price: Low → High" },
  { value: "price-high", label: "Price: High → Low" },
]

const BOARD_RADIUS_VALUES = ["25", "50", "100", "200"] as const

/** Surfboard browse map radius (miles). `any` = no distance cap (location text match only unless sort is nearest). Compact labels so the bar does not crowd/overlap. */
export const boardRadiusOptions: { value: string; label: string }[] = [
  { value: "any", label: "Radius" },
  ...BOARD_RADIUS_VALUES.map((mi) => ({
    value: mi,
    label: `${mi} mi`,
  })),
]

function normalizeInitialRadius(r: string | undefined): string {
  if (!r?.trim()) return "any"
  const t = r.trim()
  return BOARD_RADIUS_VALUES.includes(t as (typeof BOARD_RADIUS_VALUES)[number]) ? t : "any"
}

type FilterSnapshot = {
  q: string
  brand: string
  model: string
  catalogBrandId: string
  catalogBrandModelId: string
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  minPrice: string
  maxPrice: string
  location: string
  radiusMi: string
  type: string
  condition: string
  sort: string
  userLat: number | null
  userLng: number | null
}

interface BoardsListingsFiltersProps {
  initialQ?: string
  initialBrand?: string
  initialModel?: string
  /** Catalog `public.brands.id` when browsed by UUID (`brandId=`). */
  initialBrandId?: string
  /** Catalog `public.brand_models.id` when browsed by UUID (`brandModelId=`). */
  initialBrandModelId?: string
  initialDimLength?: string
  initialDimWidth?: string
  initialDimThickness?: string
  initialDimVolume?: string
  initialMinPrice?: string
  initialMaxPrice?: string
  initialLocation?: string
  /** Miles from `radius=`; `any` / empty = no distance filter in URL */
  initialRadius?: string
  initialType?: string
  initialCondition?: string
  initialSort?: string
  /**
   * When provided, URL updates run inside this transition so the parent can
   * show pending UI (Next.js loading.tsx doesn't fire for search-param navigations).
   */
  transitionStart?: (cb: () => void) => void
  isPending?: boolean
}

/** Debounce before syncing keyword/location to the URL so results update as you type without thrashing. */
const DEBOUNCE_MS = 380

export function BoardsListingsFilters({
  initialQ = "",
  initialBrand = "",
  initialModel = "",
  initialBrandId = "",
  initialBrandModelId = "",
  initialDimLength = "",
  initialDimWidth = "",
  initialDimThickness = "",
  initialDimVolume = "",
  initialMinPrice = "",
  initialMaxPrice = "",
  initialLocation = "",
  initialRadius = "",
  initialType = "all",
  initialCondition = "all",
  initialSort = BOARDS_BROWSE_DEFAULT_SORT,
  transitionStart: transitionStartProp,
  isPending = false,
}: BoardsListingsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [, internalStartTransition] = useTransition()
  const startTransition = transitionStartProp ?? internalStartTransition

  const [q, setQ] = useState(initialQ)
  const [brand, setBrand] = useState(initialBrand)
  const [model, setModel] = useState(initialModel)
  const [catalogBrandId, setCatalogBrandId] = useState(initialBrandId)
  const [catalogBrandModelId, setCatalogBrandModelId] = useState(initialBrandModelId)
  const [dimensionFields, setDimensionFields] = useState<BoardDimensionsInputValues>({
    boardLength: initialDimLength,
    boardWidthInches: initialDimWidth,
    boardThicknessInches: initialDimThickness,
    boardVolumeL: initialDimVolume,
  })
  const [minPrice, setMinPrice] = useState(initialMinPrice)
  const [maxPrice, setMaxPrice] = useState(initialMaxPrice)
  const [location, setLocation] = useState(initialLocation)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [radiusMi, setRadiusMi] = useState(() => normalizeInitialRadius(initialRadius))
  const [type, setType] = useState(initialType)
  const [condition, setCondition] = useState(initialCondition)
  const [sort, setSort] = useState(initialSort)
  const [advancedOpen, setAdvancedOpen] = useState(() =>
    hasActiveAdvancedBrowseFilters({
      brand: initialBrand,
      model: initialModel,
      catalogBrandId: initialBrandId,
      catalogBrandModelId: initialBrandModelId,
      boardLength: initialDimLength,
      boardWidthInches: initialDimWidth,
      boardThicknessInches: initialDimThickness,
      boardVolumeL: initialDimVolume,
      minPrice: initialMinPrice,
      maxPrice: initialMaxPrice,
    }),
  )

  useEffect(() => {
    prefetchBoardsBrowseBrandModelsCatalog()
  }, [])

  const browseFilterFields = useMemo<BoardsBrowseFilterFields>(
    () => ({
      q,
      brand,
      model,
      catalogBrandId,
      catalogBrandModelId,
      boardLength: dimensionFields.boardLength,
      boardWidthInches: dimensionFields.boardWidthInches,
      boardThicknessInches: dimensionFields.boardThicknessInches,
      boardVolumeL: dimensionFields.boardVolumeL,
      minPrice,
      maxPrice,
      type,
      condition,
      sort,
    }),
    [
      q,
      brand,
      model,
      catalogBrandId,
      catalogBrandModelId,
      dimensionFields.boardLength,
      dimensionFields.boardWidthInches,
      dimensionFields.boardThicknessInches,
      dimensionFields.boardVolumeL,
      minPrice,
      maxPrice,
      type,
      condition,
      sort,
    ],
  )

  const filtersRef = useRef<FilterSnapshot>({
    q: initialQ,
    brand: initialBrand,
    model: initialModel,
    catalogBrandId: initialBrandId,
    catalogBrandModelId: initialBrandModelId,
    boardLength: initialDimLength,
    boardWidthInches: initialDimWidth,
    boardThicknessInches: initialDimThickness,
    boardVolumeL: initialDimVolume,
    minPrice: initialMinPrice,
    maxPrice: initialMaxPrice,
    location: initialLocation,
    radiusMi: normalizeInitialRadius(initialRadius),
    type: initialType,
    condition: initialCondition,
    sort: initialSort,
    userLat: null,
    userLng: null,
  })
  filtersRef.current = {
    q,
    brand,
    model,
    catalogBrandId,
    catalogBrandModelId,
    boardLength: dimensionFields.boardLength,
    boardWidthInches: dimensionFields.boardWidthInches,
    boardThicknessInches: dimensionFields.boardThicknessInches,
    boardVolumeL: dimensionFields.boardVolumeL,
    minPrice,
    maxPrice,
    location,
    radiusMi,
    type,
    condition,
    sort,
    userLat,
    userLng,
  }

  const skipTextDebounceRef = useRef(true)
  const skipSelectApplyRef = useRef(true)
  /**
   * After `router.replace`, RSC props update with trimmed URL values. We store what we committed
   * so we can skip resetting local text state when it matches (avoids clobbering mid-typing and
   * survives React Strict Mode double-invoking effects).
   */
  const expectedAfterReplaceRef = useRef<{
    q: string
    location: string
    brand: string
    model: string
    catalogBrandId: string
    catalogBrandModelId: string
    boardLength: string
    boardWidthInches: string
    boardThicknessInches: string
    boardVolumeL: string
    minPrice: string
    maxPrice: string
  } | null>(null)

  // Sync filter UI when server re-renders with new searchParams (back/forward, external links).
  // Skip resetting free-text fields when the payload matches what we just pushed from this form.
  // Only arm the skip refs when a value actually changes — arming them unconditionally would cause
  // the next user interaction to be silently dropped after any server echo of the same values.
  useEffect(() => {
    const typeChanged = initialType !== filtersRef.current.type
    const conditionChanged = initialCondition !== filtersRef.current.condition
    const sortChanged = initialSort !== filtersRef.current.sort
    const nextRadius = normalizeInitialRadius(initialRadius)
    const radiusChanged = nextRadius !== filtersRef.current.radiusMi

    if (typeChanged || conditionChanged || sortChanged || radiusChanged) {
      skipSelectApplyRef.current = true
      setType(initialType)
      setCondition(initialCondition)
      setSort(initialSort)
      setRadiusMi(nextRadius)
    }

    const incomingQ = (initialQ ?? "").trim()
    const incomingLoc = (initialLocation ?? "").trim()
    const incomingBrand = (initialBrand ?? "").trim()
    const incomingModel = (initialModel ?? "").trim()
    const incomingBrandId = (initialBrandId ?? "").trim()
    const incomingBrandModelId = (initialBrandModelId ?? "").trim()
    const incomingDimLength = (initialDimLength ?? "").trim()
    const incomingDimWidth = (initialDimWidth ?? "").trim()
    const incomingDimThickness = (initialDimThickness ?? "").trim()
    const incomingDimVolume = (initialDimVolume ?? "").trim()
    const incomingMin = (initialMinPrice ?? "").trim()
    const incomingMax = (initialMaxPrice ?? "").trim()
    const expected = expectedAfterReplaceRef.current
    if (
      expected &&
      expected.q === incomingQ &&
      expected.location === incomingLoc &&
      expected.brand === incomingBrand &&
      expected.model === incomingModel &&
      expected.catalogBrandId === incomingBrandId &&
      expected.catalogBrandModelId === incomingBrandModelId &&
      expected.boardLength === incomingDimLength &&
      expected.boardWidthInches === incomingDimWidth &&
      expected.boardThicknessInches === incomingDimThickness &&
      expected.boardVolumeL === incomingDimVolume &&
      expected.minPrice === incomingMin &&
      expected.maxPrice === incomingMax
    ) {
      expectedAfterReplaceRef.current = null
      return
    }

    expectedAfterReplaceRef.current = null
    skipTextDebounceRef.current = true
    setQ(initialQ)
    setBrand(initialBrand)
    setModel(initialModel)
    setCatalogBrandId(initialBrandId ?? "")
    setCatalogBrandModelId(initialBrandModelId ?? "")
    setDimensionFields({
      boardLength: initialDimLength,
      boardWidthInches: initialDimWidth,
      boardThicknessInches: initialDimThickness,
      boardVolumeL: initialDimVolume,
    })
    setMinPrice(initialMinPrice)
    setMaxPrice(initialMaxPrice)
    setLocation(initialLocation)
    setUserLat(null)
    setUserLng(null)
  }, [
    initialQ,
    initialBrand,
    initialModel,
    initialBrandId,
    initialBrandModelId,
    initialDimLength,
    initialDimWidth,
    initialDimThickness,
    initialDimVolume,
    initialMinPrice,
    initialMaxPrice,
    initialLocation,
    initialRadius,
    initialType,
    initialCondition,
    initialSort,
  ])

  const pushSearchParams = useCallback(
    async (override?: Partial<FilterSnapshot>) => {
      const merged = { ...filtersRef.current, ...override }
      const locationForGeocode = merged.location.trim()

      let resolvedLat = merged.userLat
      let resolvedLng = merged.userLng

      if ((resolvedLat == null || resolvedLng == null) && locationForGeocode) {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationForGeocode)}`)
          if (res.ok) {
            const data = (await res.json()) as { lat?: number; lng?: number }
            if (data.lat != null && data.lng != null) {
              resolvedLat = data.lat
              resolvedLng = data.lng
            }
          }
        } catch {
          // proceed without coordinates
        }
      }

      // After any await, use the latest filter state so `q` / location match what the user typed
      // while geocode was in flight (avoids replacing the URL with a stale snapshot).
      const live = { ...filtersRef.current, ...override }
      const liveLocation = live.location.trim()
      if (liveLocation !== locationForGeocode) {
        resolvedLat = live.userLat
        resolvedLng = live.userLng
      }

      const params = new URLSearchParams()
      if (live.q.trim()) params.set("q", live.q.trim())
      if (live.brand.trim()) params.set("brand", live.brand.trim())
      if (live.model.trim()) params.set("model", live.model.trim())

      const bmId = live.catalogBrandModelId.trim()
      const bId = live.catalogBrandId.trim()
      if (bmId && isUuidString(bmId)) {
        params.set("brandModelId", bmId)
        const bid = bId && isUuidString(bId) ? bId : ""
        if (bid) params.set("brandId", bid)
      } else if (bId && isUuidString(bId)) {
        params.set("brandId", bId)
      }

      appendBoardDimensionBrowseParams(params, {
        boardLength: live.boardLength,
        boardWidthInches: live.boardWidthInches,
        boardThicknessInches: live.boardThicknessInches,
        boardVolumeL: live.boardVolumeL,
      })

      const minT = live.minPrice.trim()
      const maxT = live.maxPrice.trim()
      const minN = minT ? Math.round(Number(minT)) : NaN
      const maxN = maxT ? Math.round(Number(maxT)) : NaN
      if (Number.isFinite(minN) && minN >= 0) params.set("minPrice", String(minN))
      if (Number.isFinite(maxN) && maxN >= 0) params.set("maxPrice", String(maxN))

      if (liveLocation) params.set("location", liveLocation)
      if (live.type && live.type !== "all") params.set("type", live.type)
      if (live.condition && live.condition !== "all") params.set("condition", live.condition)
      if (live.sort && live.sort !== BOARDS_BROWSE_DEFAULT_SORT) params.set("sort", live.sort)
      params.set("page", "1")

      if (
        live.radiusMi &&
        live.radiusMi !== "any" &&
        BOARD_RADIUS_VALUES.includes(live.radiusMi as (typeof BOARD_RADIUS_VALUES)[number])
      ) {
        params.set("radius", live.radiusMi)
      }

      if (
        resolvedLat != null &&
        resolvedLng != null &&
        (liveLocation === locationForGeocode || (live.userLat != null && live.userLng != null))
      ) {
        params.set("lat", String(resolvedLat))
        params.set("lng", String(resolvedLng))
      }

      expectedAfterReplaceRef.current = {
        q: live.q.trim(),
        location: liveLocation,
        brand: live.brand.trim(),
        model: live.model.trim(),
        catalogBrandId: live.catalogBrandId.trim(),
        catalogBrandModelId: live.catalogBrandModelId.trim(),
        boardLength: live.boardLength.trim(),
        boardWidthInches: live.boardWidthInches.trim(),
        boardThicknessInches: live.boardThicknessInches.trim(),
        boardVolumeL: live.boardVolumeL.trim(),
        minPrice: minT,
        maxPrice: maxT,
      }
      startTransition(() => {
        router.replace(
          `${pathname}${params.toString() ? `?${params.toString()}` : ""}`,
          { scroll: false },
        )
      })
    },
    [pathname, router, startTransition],
  )

  // Keyword, location, brand, model, dimensions, price: debounced URL sync (live results).
  useEffect(() => {
    if (skipTextDebounceRef.current) {
      skipTextDebounceRef.current = false
      return
    }
    const t = setTimeout(() => {
      void pushSearchParams()
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [
    q,
    location,
    brand,
    model,
    catalogBrandId,
    catalogBrandModelId,
    dimensionFields.boardLength,
    dimensionFields.boardWidthInches,
    dimensionFields.boardThicknessInches,
    dimensionFields.boardVolumeL,
    minPrice,
    maxPrice,
    pushSearchParams,
  ])

  // Selects fire immediately
  useEffect(() => {
    if (skipSelectApplyRef.current) {
      skipSelectApplyRef.current = false
      return
    }
    void pushSearchParams()
  }, [type, condition, sort, radiusMi, pushSearchParams])

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      toast({
        title: "Location not supported",
        description: "Your browser doesn't support geolocation.",
        variant: "destructive",
      })
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const labelFromGeo = async () => {
          try {
            const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
            if (res.ok) {
              const { displayName } = await res.json()
              return (displayName as string) || "My location"
            }
          } catch {
            /* fall through */
          }
          return "My location"
        }
        const displayName = await labelFromGeo()
        setUserLat(lat)
        setUserLng(lng)
        setLocation(displayName)
        setLocationLoading(false)
        await pushSearchParams({ location: displayName, userLat: lat, userLng: lng })
      },
      () => {
        toast({
          title: "Location unavailable",
          description: "Allow location access or enter a city or ZIP.",
          variant: "destructive",
        })
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function clearAdvancedFilters() {
    setBrand("")
    setModel("")
    setCatalogBrandId("")
    setCatalogBrandModelId("")
    setDimensionFields({
      boardLength: "",
      boardWidthInches: "",
      boardThicknessInches: "",
      boardVolumeL: "",
    })
    setMinPrice("")
    setMaxPrice("")
    skipTextDebounceRef.current = true
    void pushSearchParams({
      brand: "",
      model: "",
      catalogBrandId: "",
      catalogBrandModelId: "",
      boardLength: "",
      boardWidthInches: "",
      boardThicknessInches: "",
      boardVolumeL: "",
      minPrice: "",
      maxPrice: "",
    })
  }

  const advancedFilterProps: BoardsAdvancedFiltersPanelProps = {
    open: advancedOpen,
    onOpenChange: setAdvancedOpen,
    filterFields: browseFilterFields,
    dimensionFields,
    minPrice,
    maxPrice,
    brand,
    catalogBrandId,
    model,
    isPending,
    onDimensionFieldsChange: (patch) =>
      setDimensionFields((prev) => ({ ...prev, ...patch })),
    onMinPriceChange: setMinPrice,
    onMaxPriceChange: setMaxPrice,
    onBrandTextChange: (v) => {
      setBrand(v)
      setCatalogBrandId("")
      setCatalogBrandModelId("")
      setModel("")
    },
    onCatalogBrandPicked: (b) => {
      setBrand(b.name)
      setCatalogBrandId(b.id)
      setCatalogBrandModelId("")
      setModel("")
      void pushSearchParams({
        catalogBrandId: b.id,
        catalogBrandModelId: "",
        brand: b.name,
        model: "",
      })
    },
    onModelTextChange: (v) => {
      setModel(v)
      setCatalogBrandModelId("")
    },
    onCatalogModelPicked: (row) => {
      setBrand(row.brandName)
      setCatalogBrandId(row.brandId)
      setCatalogBrandModelId(row.id)
      setModel(row.name)
      void pushSearchParams({
        catalogBrandModelId: row.id,
        catalogBrandId: row.brandId,
        brand: row.brandName,
        model: row.name,
      })
    },
    onApplyFilters: () => {
      skipTextDebounceRef.current = true
      void pushSearchParams()
    },
    onClearAdvanced: clearAdvancedFilters,
  }

  const renderLocationRadius = (wrapperClassName: string, locationInnerClassName: string) => (
    <div className={wrapperClassName}>
      <div className={cn("relative", locationInnerClassName)}>
        <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <LocationInputSuggest
          name="location"
          placeholder="City or ZIP"
          value={location}
          onChange={(v) => {
            setLocation(v)
            setUserLat(null)
            setUserLng(null)
            if (!v.trim()) setRadiusMi("any")
          }}
          onPickSuggestion={(place) => {
            setLocation(place.label)
            setUserLat(place.lat)
            setUserLng(place.lng)
            void pushSearchParams({
              location: place.label,
              userLat: place.lat,
              userLng: place.lng,
            })
          }}
          listboxId="boards-location-suggest"
          endSlot={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-foreground hover:bg-muted"
              title="Use my location"
              aria-label="Use my location"
              disabled={locationLoading}
              onClick={handleUseMyLocation}
            >
              <LocateFixed className={cn("h-4 w-4", userLat != null && "text-primary")} />
            </Button>
          }
        />
      </div>
      <Select name="radius" value={radiusMi} onValueChange={setRadiusMi}>
        <SelectTrigger
          aria-label="Search radius (miles from location)"
          className={cn(siteFilterSelectTriggerClassName(), "w-[8.5rem] shrink-0")}
        >
          <SelectValue placeholder="Radius" />
        </SelectTrigger>
        <SelectContent>
          {boardRadiusOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const renderTypeConditionSort = (
    wrapperClassName: string,
    mobile = false,
  ) => {
    const triggerClassName = mobile ? "w-auto shrink-0" : undefined
    const triggerWidths = mobile
      ? ["min-w-[9.5rem]", "min-w-[8.5rem]", "min-w-[8rem]"]
      : [undefined, undefined, undefined]

    return (
      <div className={wrapperClassName}>
        <div className="min-w-0 md:w-[200px] md:shrink-0">
          <Select name="type" value={type} onValueChange={setType}>
            <SelectTrigger
              className={cn(siteFilterSelectTriggerClassName(), triggerClassName, triggerWidths[0])}
            >
              <SelectValue placeholder="Board type" />
            </SelectTrigger>
            <SelectContent>
              {boardTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 md:w-[120px] md:shrink-0">
          <Select name="condition" value={condition} onValueChange={setCondition}>
            <SelectTrigger
              className={cn(siteFilterSelectTriggerClassName(), triggerClassName, triggerWidths[1])}
            >
              <SelectValue placeholder="Condition Any" />
            </SelectTrigger>
            <SelectContent>
              {boardConditions.map((cond) => (
                <SelectItem key={cond.value} value={cond.value}>
                  {cond.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 md:w-[140px] md:shrink-0">
          <Select name="sort" value={sort} onValueChange={setSort}>
            <SelectTrigger
              className={cn(siteFilterSelectTriggerClassName(), triggerClassName, triggerWidths[2])}
            >
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              {boardSortOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  const renderSearchField = (wrapperClassName: string) => (
    <div className={wrapperClassName}>
      <SiteSearchShell
        actionSlot={<SiteSearchFormSubmitButton>Search</SiteSearchFormSubmitButton>}
      >
        <BoardsListingsSearchField
          value={q}
          onChange={setQ}
          name="q"
          className="w-full"
          inputClassName={siteSearchInputClassName()}
        />
      </SiteSearchShell>
    </div>
  )

  return (
    <>
      {/* Desktop: original filter bar — unchanged from pre-mobile work */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void pushSearchParams()
        }}
        className={cn(
          "hidden w-full min-w-0 max-w-full items-center gap-2 md:flex md:flex-nowrap md:overflow-x-auto md:pb-0.5 [scrollbar-width:thin]",
        )}
      >
        {renderLocationRadius(
          "flex max-w-full min-w-[200px] shrink-0 items-center gap-2 md:w-[min(24rem,34vw)] md:min-w-[19rem]",
          "min-w-0 flex-1",
        )}
        {renderTypeConditionSort("flex w-auto shrink-0 flex-nowrap gap-2")}
        {renderSearchField("w-full min-w-[12rem] flex-1")}
      </form>

      {/* Mobile: search on top + horizontal filter slider */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void pushSearchParams()
        }}
        className="flex w-full min-w-0 max-w-full flex-col gap-2 md:hidden"
      >
        {renderSearchField("w-full min-w-0")}
        <div
          className={cn(
            "-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 sm:-mx-2 sm:px-2",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {renderLocationRadius(
            "flex shrink-0 items-center gap-2",
            "w-[min(14rem,58vw)] shrink-0",
          )}
          {renderTypeConditionSort("flex shrink-0 items-center gap-2", true)}
          <BoardsAdvancedFiltersTrigger {...advancedFilterProps} />
        </div>
      </form>

      <BoardsAdvancedFiltersMobileSlider {...advancedFilterProps} />
      <BoardsAdvancedFiltersPanel {...advancedFilterProps} />
    </>
  )
}
