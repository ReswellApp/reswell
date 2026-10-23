"use client"

import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from "react"
import { Check, ChevronDown, ChevronsUpDown, Info, Package, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  SHOP_STORE_DEFAULT_PACKAGE_NAME,
  createShopSavedPackageId,
  formatShopMeasure,
  formatShopPackedSizeSummary,
  formatStoreDefaultPackageLabel,
  lengthFromInches,
  shopBoardPackSizeMaxLengthIn,
  shopBoardPackSizes,
  shopShippingDefaultsFromDraft,
  shopShippingDraftFromDefaults,
  weightFromLb,
  type ShopDimensionUnit,
  type ShopSavedPackedSize,
  type ShopShippingDefaults,
  type ShopShippingDraftInput,
  type ShopShippingDraftPackage,
  type ShopWeightUnit,
} from "@/lib/shop-shipping-defaults"
import { cn } from "@/lib/utils"

interface ShopShippingDefaultCardProps {
  defaults: ShopShippingDefaults
  resetKey: number
  busy: boolean
  onCommit: (draft: ShopShippingDraftInput) => void
  onInvalid: (message: string) => void
}

export function ShopShippingDefaultCard({
  defaults,
  resetKey,
  busy,
  onCommit,
  onInvalid,
}: ShopShippingDefaultCardProps) {
  const physicalId = useId()
  const [draft, setDraft] = useState(() => shopShippingDraftFromDefaults(defaults))
  const [seenKey, setSeenKey] = useState(resetKey)
  const [menuOpen, setMenuOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  draftRef.current = draft

  if (resetKey !== seenKey) {
    setSeenKey(resetKey)
    const next = shopShippingDraftFromDefaults(defaults)
    draftRef.current = next
    dirtyRef.current = false
    setDraft(next)
  }

  useEffect(() => {
    if (!menuOpen) return
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [menuOpen])

  function replace(next: ShopShippingDraftInput, commitMode?: "silent" | "notify") {
    draftRef.current = next
    setDraft(next)
    if (!commitMode) {
      dirtyRef.current = true
      return
    }
    const parsed = shopShippingDefaultsFromDraft(next)
    if (!parsed.ok) {
      dirtyRef.current = true
      onInvalid(parsed.error)
      return
    }
    dirtyRef.current = false
    onCommit(next)
  }

  function commit(mode: "silent" | "notify" = "silent") {
    if (mode === "silent" && !dirtyRef.current) return
    replace(draftRef.current, mode)
  }

  function fillFromPackage(
    pkg: Pick<ShopSavedPackedSize, "name" | "lengthIn" | "widthIn" | "heightIn" | "weightLb">,
    presetId: string | null,
  ): ShopShippingDraftInput {
    const current = draftRef.current
    return {
      ...current,
      name: pkg.name,
      presetId,
      length: formatShopMeasure(lengthFromInches(pkg.lengthIn, current.dimensionUnit)),
      width: formatShopMeasure(lengthFromInches(pkg.widthIn, current.dimensionUnit)),
      height: formatShopMeasure(lengthFromInches(pkg.heightIn, current.dimensionUnit)),
      weight: formatShopMeasure(weightFromLb(pkg.weightLb, current.weightUnit)),
    }
  }

  function selectSaved(pkg: ShopShippingDraftPackage) {
    setMenuOpen(false)
    replace(fillFromPackage(pkg, null), "notify")
  }

  function editMeasure(key: "length" | "width" | "height" | "weight", value: string) {
    const current = draftRef.current
    replace({
      ...current,
      presetId: null,
      name: current.presetId ? SHOP_STORE_DEFAULT_PACKAGE_NAME : current.name,
      [key]: value,
    })
  }

  function changeUnits(dimensionUnit: ShopDimensionUnit, weightUnit: ShopWeightUnit) {
    const current = draftRef.current
    const parsed = shopShippingDefaultsFromDraft(current)
    if (!parsed.ok) {
      replace({ ...current, dimensionUnit, weightUnit })
      return
    }
    replace(shopShippingDraftFromDefaults({ ...parsed.defaults, dimensionUnit, weightUnit }))
  }

  function saveCurrentBox() {
    const parsed = shopShippingDefaultsFromDraft(draftRef.current)
    if (!parsed.ok || !parsed.defaults.storeDefault) {
      onInvalid(parsed.ok ? "Enter length, width, height, and weight for the shop box." : parsed.error)
      return
    }
    const source = parsed.defaults.storeDefault
    const count = draftRef.current.savedPackages.length + 1
    replace(
      {
        ...draftRef.current,
        savedPackages: [
          ...draftRef.current.savedPackages,
          {
            id: createShopSavedPackageId(),
            name: count === 1 ? "Packed size" : `Packed size ${count}`,
            lengthIn: source.lengthIn,
            widthIn: source.widthIn,
            heightIn: source.heightIn,
            weightLb: source.weightLb,
            presetId: null,
          },
        ],
      },
      "notify",
    )
    setMenuOpen(false)
    setAdvancedOpen(true)
  }

  const parsed = shopShippingDefaultsFromDraft(draft)
  const storePackage = parsed.ok ? parsed.defaults.storeDefault : null
  const summary = storePackage
    ? formatShopPackedSizeSummary(storePackage, {
        dimensionUnit: draft.dimensionUnit,
        weightUnit: draft.weightUnit,
      })
    : null
  const triggerLabel = formatStoreDefaultPackageLabel(draft.name || SHOP_STORE_DEFAULT_PACKAGE_NAME, summary)
  const fieldsDisabled = busy || !draft.physicalProduct

  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-sm" aria-labelledby="shop-shipping-heading">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
        <h2 id="shop-shipping-heading" className="text-[15px] font-medium text-foreground">
          Shipping
        </h2>
        <div className="flex items-center gap-2.5">
          <label htmlFor={physicalId} className="text-sm text-muted-foreground">
            Physical product
          </label>
          <Switch
            id={physicalId}
            checked={draft.physicalProduct}
            disabled={busy}
            onCheckedChange={(value) => replace({ ...draftRef.current, physicalProduct: value === true }, "notify")}
            className="data-[state=checked]:bg-foreground data-[state=unchecked]:bg-neutral-300 dark:data-[state=unchecked]:bg-neutral-600"
          />
        </div>
      </div>

      <div className={cn("space-y-4 px-4 pb-5 sm:px-5", fieldsDisabled && "opacity-50")}>
        <FieldRow label="Package when shipped alone">
          <div ref={menuRef} className="relative w-fit max-w-full">
            <button
              type="button"
              className="flex h-10 max-w-xl items-center gap-2 rounded-xl bg-muted px-3 text-left text-sm text-foreground disabled:cursor-not-allowed"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              disabled={fieldsDisabled}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
            {menuOpen ? (
              <div
                role="listbox"
                aria-label="Package when shipped alone"
                className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-80 w-max min-w-full max-w-[28rem] overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg"
              >
                {draft.savedPackages.length > 0 ? (
                  <MenuGroup label="Saved packed sizes">
                    {draft.savedPackages.map((pkg) => (
                      <PackageOption
                        key={pkg.id}
                        pkg={pkg}
                        units={draft}
                        selected={false}
                        onSelect={() => selectSaved(pkg)}
                      />
                    ))}
                  </MenuGroup>
                ) : null}
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={saveCurrentBox}
                >
                  Save current box as a packed size
                </button>
              </div>
            ) : null}
          </div>
        </FieldRow>

        <FieldRow
          label="Packed product size"
          info="Outside length, width, and height of the box you ship in."
        >
          <div
            className="flex flex-wrap items-center gap-2"
            onBlur={(event) => onGroupBlur(event, () => commit("silent"))}
          >
            <MeasureField
              prefix="L"
              label="Length"
              value={draft.length}
              disabled={fieldsDisabled}
              onChange={(value) => editMeasure("length", value)}
            />
            <span className="text-sm text-muted-foreground" aria-hidden>
              ×
            </span>
            <MeasureField
              prefix="W"
              label="Width"
              value={draft.width}
              disabled={fieldsDisabled}
              onChange={(value) => editMeasure("width", value)}
            />
            <span className="text-sm text-muted-foreground" aria-hidden>
              ×
            </span>
            <MeasureField
              prefix="H"
              label="Height"
              value={draft.height}
              disabled={fieldsDisabled}
              onChange={(value) => editMeasure("height", value)}
            />
            <UnitSelect
              label="Length unit"
              value={draft.dimensionUnit}
              disabled={fieldsDisabled}
              options={[
                ["in", "in"],
                ["cm", "cm"],
              ]}
              onChange={(value) => changeUnits(value as ShopDimensionUnit, draft.weightUnit)}
            />
          </div>
        </FieldRow>

        <FieldRow label="Weight" info="Weight of the packed box, including the product and packaging.">
          <div
            className="flex flex-wrap items-center gap-2"
            onBlur={(event) => onGroupBlur(event, () => commit("silent"))}
          >
            <label className="flex h-10 w-full max-w-[16rem] items-center rounded-xl bg-muted px-3">
              <span className="sr-only">Weight</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.0"
                value={draft.weight}
                disabled={fieldsDisabled}
                onChange={(event) => editMeasure("weight", event.target.value)}
                className="w-full bg-transparent text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground/80"
              />
            </label>
            <UnitSelect
              label="Weight unit"
              value={draft.weightUnit}
              disabled={fieldsDisabled}
              options={[
                ["lb", "lb"],
                ["oz", "oz"],
                ["kg", "kg"],
              ]}
              onChange={(value) => changeUnits(draft.dimensionUnit, value as ShopWeightUnit)}
            />
          </div>
        </FieldRow>
      </div>

      {advancedOpen ? (
        <div className="space-y-6 border-t border-border/60 px-4 py-5 sm:px-5">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">Board sizes</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Match each board length to a saved packed size. Open surfboard listings pick up that box when you save.
              </p>
            </div>
            <label className="block max-w-xs">
              <span className="text-xs font-medium text-muted-foreground">Box name</span>
              <input
                value={draft.name}
                maxLength={48}
                disabled={busy}
                onChange={(event) => replace({ ...draftRef.current, name: event.target.value })}
                onBlur={() => commit("silent")}
                className="mt-1 h-10 w-full rounded-xl bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15 disabled:opacity-60"
              />
            </label>
            <ul className="space-y-3">
              {shopBoardPackSizes().map((size) => {
                const ref = draft.boardSizes[size.id] || "store_default"
                const cartonLength = packageLengthForRef(draft, ref, storePackage)
                const tooSmall =
                  cartonLength != null && cartonLength + 0.26 < shopBoardPackSizeMaxLengthIn(size.id)
                return (
                  <li key={size.id} className="grid gap-1.5 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-8">
                    <div>
                      <p className="text-sm text-foreground">{size.label}</p>
                      <p className="text-xs text-muted-foreground">{size.hint}</p>
                    </div>
                    <div className="max-w-xl">
                      <PackageSelect
                        label={`${size.label} packed size`}
                        value={ref}
                        disabled={busy}
                        onChange={(value) => {
                          const boardSizes = { ...draftRef.current.boardSizes }
                          if (value === "store_default") delete boardSizes[size.id]
                          else boardSizes[size.id] = value
                          replace({ ...draftRef.current, boardSizes }, "notify")
                        }}
                      >
                        <option value="store_default">{triggerLabel}</option>
                        {draft.savedPackages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} - {formatShopPackedSizeSummary(pkg, draft)}
                          </option>
                        ))}
                      </PackageSelect>
                      {tooSmall ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Shorter than the longest boards in this size.
                        </p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
            {draft.savedPackages.length > 0 ? (
              <ul className="space-y-2">
                {draft.savedPackages.map((pkg) => (
                  <li key={pkg.id} className="flex items-center gap-2">
                    <input
                      value={pkg.name}
                      maxLength={48}
                      aria-label={`${pkg.name} name`}
                      disabled={busy}
                      onChange={(event) =>
                        replace({
                          ...draftRef.current,
                          savedPackages: draftRef.current.savedPackages.map((row) =>
                            row.id === pkg.id ? { ...row, name: event.target.value } : row,
                          ),
                        })
                      }
                      onBlur={() => commit("notify")}
                      className="h-10 w-40 rounded-xl bg-muted px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/15"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {formatShopPackedSizeSummary(pkg, draft)}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Remove ${pkg.name}`}
                      disabled={busy}
                      onClick={() => {
                        const boardSizes = { ...draftRef.current.boardSizes }
                        for (const key of Object.keys(boardSizes)) {
                          if (boardSizes[key] === pkg.id) delete boardSizes[key]
                        }
                        replace(
                          {
                            ...draftRef.current,
                            savedPackages: draftRef.current.savedPackages.filter((row) => row.id !== pkg.id),
                            boardSizes,
                          },
                          "notify",
                        )
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between gap-3 border-t border-border/60 bg-muted/40 px-4 text-left sm:px-5"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        <span className="flex flex-wrap gap-2 py-2.5">
          <FooterChip>Board sizes</FooterChip>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", advancedOpen && "rotate-180")}
          aria-hidden
        />
      </button>
    </section>
  )
}

function packageLengthForRef(
  draft: ShopShippingDraftInput,
  ref: string,
  storePackage: ShopSavedPackedSize | null,
): number | null {
  if (ref === "store_default") return storePackage?.lengthIn ?? null
  return draft.savedPackages.find((pkg) => pkg.id === ref)?.lengthIn ?? null
}

function onGroupBlur(event: FocusEvent<HTMLDivElement>, commit: () => void) {
  const next = event.relatedTarget
  if (next instanceof Node && event.currentTarget.contains(next)) return
  commit()
}

function FieldRow({
  label,
  info,
  children,
}: {
  label: string
  info?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[13.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-8">
      <div className="flex items-center gap-1.5 text-sm text-foreground">
        <span>{label}</span>
        {info ? (
          <button
            type="button"
            className="text-muted-foreground"
            aria-label={info}
            title={info}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function MeasureField({
  prefix,
  label,
  value,
  disabled,
  onChange,
}: {
  prefix: string
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex h-10 w-[6.75rem] items-center gap-1.5 rounded-xl bg-muted px-3">
      <span className="text-sm text-muted-foreground">{prefix}</span>
      <input
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.0"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground/80"
      />
    </label>
  )
}

function UnitSelect({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  options: [string, string][]
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 appearance-none rounded-xl bg-muted pl-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-foreground/15 disabled:cursor-not-allowed"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
}

function PackageSelect({
  label,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none truncate rounded-xl bg-muted pl-3 pr-8 text-sm text-foreground outline-none focus:ring-2 focus:ring-foreground/15 disabled:cursor-not-allowed"
      >
        {children}
      </select>
      <ChevronsUpDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  )
}

function MenuGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function PackageOption({
  pkg,
  units,
  selected,
  onSelect,
}: {
  pkg: Pick<ShopSavedPackedSize, "name" | "lengthIn" | "widthIn" | "heightIn" | "weightLb">
  units: { dimensionUnit: ShopDimensionUnit; weightUnit: ShopWeightUnit }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground">{pkg.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatShopPackedSizeSummary(pkg, units)}
        </span>
      </span>
      {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </button>
  )
}

function FooterChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-lg bg-muted px-2.5 text-[13px] text-foreground">
      {children}
    </span>
  )
}
