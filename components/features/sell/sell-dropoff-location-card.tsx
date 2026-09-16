"use client"

import { useId, useState } from "react"
import { ChevronDown, MapPin } from "lucide-react"

import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import { cn } from "@/lib/utils"
import {
  formatDropoffBoxSize,
  matchDropoffBoxRule,
  type DropoffBoxMatch,
} from "@/lib/dropoff-location-box-rules"
import type { PublicDropoffLocation } from "@/lib/dropoff-location-types"

export type SellDropoffLocationCardProps = {
  locations: PublicDropoffLocation[]
  selectedLocationId: string
  boardLength: string
  boardWidthInches: string
  onSelect: (locationId: string) => void
  onClear: () => void
}

export function matchPublicDropoffLocation(
  location: PublicDropoffLocation,
  boardLength: string,
  boardWidthInches: string,
): DropoffBoxMatch | null {
  return matchDropoffBoxRule(location.boxRules, { boardLength, boardWidthInches })
}

export function formatPublicDropoffCity(location: PublicDropoffLocation): string {
  const city = location.city.trim() || location.name.trim()
  const state = location.state.trim()
  return state ? `${city}, ${state}` : city
}

function DropoffCityOption({
  location,
  selected,
  boardLength,
  boardWidthInches,
  onSelect,
}: {
  location: PublicDropoffLocation
  selected: boolean
  boardLength: string
  boardWidthInches: string
  onSelect: (locationId: string) => void
}) {
  const match = matchPublicDropoffLocation(location, boardLength, boardWidthInches)
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={!match}
      onClick={() => {
        if (!match) return
        onSelect(location.id)
      }}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left transition-colors sm:rounded-xl sm:px-3.5 sm:py-3",
        selected
          ? "border-foreground bg-background shadow-sm"
          : "border-border bg-muted/40 hover:border-foreground/30 hover:bg-muted/60",
        !match && "cursor-not-allowed opacity-70 hover:border-border hover:bg-muted/40",
      )}
    >
      <p className="text-xs font-semibold sm:text-sm">{formatPublicDropoffCity(location)}</p>
      {match ? (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
          We&apos;ll send drop-off details after it sells.
        </p>
      ) : (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
          {boardLength.trim()
            ? "This board is outside the sizes we pack here right now (up to 6'6, and 6'0 boards need to be 22\" wide or less). Pack and ship it yourself, or add width if it is 6'0 or under."
            : "Add board length (and width if it is 6'0 or under) in Photos to use this city."}
        </p>
      )}
    </button>
  )
}

export function SellDropoffLocationCard({
  locations,
  selectedLocationId,
  boardLength,
  boardWidthInches,
  onSelect,
  onClear,
}: SellDropoffLocationCardProps) {
  const listId = useId()
  const [citiesOpen, setCitiesOpen] = useState(Boolean(selectedLocationId))
  const selected = locations.find((row) => row.id === selectedLocationId) ?? null
  const selectedMatch = selected
    ? matchPublicDropoffLocation(selected, boardLength, boardWidthInches)
    : null

  if (locations.length === 0) return null

  return (
    <div className="space-y-2 sm:space-y-3">
      <p className="text-xs font-medium text-foreground sm:text-sm">How will this board get packed?</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {
            setCitiesOpen(false)
            onClear()
          }}
          className={cn(
            "w-full rounded-lg border p-3 text-left transition-colors sm:rounded-xl sm:p-4",
            !selectedLocationId
              ? "border-foreground bg-background shadow-sm"
              : "border-border hover:border-foreground/30",
          )}
        >
          <p className="text-xs font-semibold sm:text-sm">I&apos;ll pack and ship it myself</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Enter the outer box size and weight you&apos;ll ship in.
          </p>
        </button>

        <div
          className={cn(
            "w-full rounded-lg border p-3 transition-colors sm:rounded-xl sm:p-4",
            selected
              ? "border-foreground bg-background shadow-sm"
              : citiesOpen
                ? "border-foreground/40 bg-background"
                : "border-border",
          )}
        >
          <button
            type="button"
            aria-expanded={citiesOpen}
            aria-controls={listId}
            onClick={() => setCitiesOpen((open) => !open)}
            className="flex w-full items-start gap-2.5 text-left"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-semibold sm:text-sm">
                {selected
                  ? `Drop off in ${formatPublicDropoffCity(selected)} — we pack and ship it`
                  : "Drop off nearby — we pack and ship it"}
              </p>
              <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
                {selected
                  ? "After it sells, drop the board off in this city. We'll send you the location and pack and ship it."
                  : "Find a city near you. After it sells, drop the board off and we pack and ship it."}
              </p>
            </div>
            <ChevronDown
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                citiesOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          <SmoothCollapse open={citiesOpen} className="duration-200">
            <div id={listId} className="space-y-2 pt-3" role="listbox" aria-label="Drop-off cities">
              <p className="pl-[1.625rem] text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                Cities we serve
              </p>
              <div className="space-y-2 pl-[1.625rem]">
                {locations.map((location) => (
                  <DropoffCityOption
                    key={location.id}
                    location={location}
                    selected={selectedLocationId === location.id}
                    boardLength={boardLength}
                    boardWidthInches={boardWidthInches}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </div>
          </SmoothCollapse>

          {selected && selectedMatch ? (
            <p className="mt-2 pl-[1.625rem] text-xs text-foreground sm:text-sm">
              Box size for this board:{" "}
              <span className="font-medium">{formatDropoffBoxSize(selectedMatch.rule)}</span>
              {" "}({selectedMatch.rule.label})
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
