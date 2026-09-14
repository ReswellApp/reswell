"use client"

import { MapPin } from "lucide-react"

import { Label } from "@/components/ui/label"
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

export function SellDropoffLocationCard({
  locations,
  selectedLocationId,
  boardLength,
  boardWidthInches,
  onSelect,
  onClear,
}: SellDropoffLocationCardProps) {
  if (locations.length === 0) return null

  return (
    <div className="space-y-2 sm:space-y-3">
      <p className="text-xs font-medium text-foreground sm:text-sm">How will this board get packed?</p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onClear}
          className={cn(
            "w-full rounded-lg border p-3 text-left transition-colors sm:rounded-xl sm:p-4",
            !selectedLocationId
              ? "border-foreground bg-background shadow-sm"
              : "border-border",
          )}
        >
          <p className="text-xs font-semibold sm:text-sm">I&apos;ll pack and ship it myself</p>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Enter the outer box size and weight you&apos;ll ship in.
          </p>
        </button>
        {locations.map((location) => {
          const match = matchPublicDropoffLocation(location, boardLength, boardWidthInches)
          const selected = selectedLocationId === location.id
          const addressLine = [location.addressLine1, location.city, location.state]
            .filter(Boolean)
            .join(", ")
          return (
            <button
              key={location.id}
              type="button"
              onClick={() => {
                if (match) onSelect(location.id)
              }}
              disabled={!match}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors sm:rounded-xl sm:p-4",
                selected ? "border-foreground bg-background shadow-sm" : "border-border",
                !match && "cursor-not-allowed opacity-70",
              )}
            >
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <Label className="cursor-pointer text-xs font-semibold sm:text-sm">
                    Drop off in {location.name} — we pack and ship it
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground sm:text-sm sm:leading-relaxed">
                    After it sells, drop the board at {addressLine || location.name}. We pack it
                    and ship it for you.
                  </p>
                  {match ? (
                    <p className="text-xs text-foreground sm:text-sm">
                      Box size for this board:{" "}
                      <span className="font-medium">{formatDropoffBoxSize(match.rule)}</span>
                      {" "}({match.rule.label})
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground sm:text-sm">
                      {boardLength.trim()
                        ? "This board is outside the sizes we pack here right now (up to 6'6, and 6'0 boards need to be 22\" wide or less). Pack and ship it yourself, or add width if it is 6'0 or under."
                        : "Add board length (and width if it is 6'0 or under) in Photos to use this dropoff."}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
