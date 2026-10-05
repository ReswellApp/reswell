"use client"

import Image from "next/image"
import Link from "next/link"
import { ChoiceChip } from "@/components/features/dashboard/listings/choice-chip"
import { Input } from "@/components/ui/input"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import {
  listingDeskFacets,
  type ListingDeskSpec,
} from "@/lib/listings-desk-fields"
import { cn } from "@/lib/utils"

const quietInputClass =
  "h-10 rounded-xl border-border/70 bg-background shadow-none ring-offset-0 transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-foreground/25 focus-visible:ring-2 focus-visible:ring-foreground/10 focus-visible:ring-offset-0 md:text-sm"

interface ListingEditorSpecsProps {
  listingId: string
  section: string
  spec: ListingDeskSpec
  images: { url: string; thumbnail_url?: string | null; is_primary: boolean | null }[] | null
  editHref: string
  disabled: boolean
  onChange: (patch: Partial<ListingDeskSpec>) => void
}

export function ListingEditorSpecs({
  listingId,
  section,
  spec,
  images,
  editHref,
  disabled,
  onChange,
}: ListingEditorSpecsProps) {
  const facets = listingDeskFacets(section)
  const photos = (images ?? []).filter((image) => image.url)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[12px] font-medium text-muted-foreground">Photos</p>
        {photos.length > 0 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {photos.map((image) => (
              <div
                key={image.url}
                className="relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted"
              >
                <Image
                  src={image.thumbnail_url || image.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="72px"
                  unoptimized={listingImageShouldBypassOptimization(image.thumbnail_url || image.url)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-muted-foreground">No photos yet.</p>
        )}
        <Link href={editHref} className="mt-2 inline-flex min-h-10 items-center text-[13px] font-medium text-foreground underline-offset-4 hover:underline">
          Edit photos
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SpecText
          id={`${listingId}-brand`}
          label="Brand"
          value={spec.brand}
          disabled={disabled}
          placeholder="Brand"
          onChange={(brand) => onChange({ brand })}
        />
        <SpecText
          id={`${listingId}-model`}
          label="Model"
          value={spec.model}
          disabled={disabled}
          placeholder="Model"
          onChange={(model) => onChange({ model })}
        />
      </div>

      {section === "surfboards" ? (
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Board size</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SpecText id={`${listingId}-length`} label="Length" value={spec.boardLength} disabled={disabled} placeholder="6'1" onChange={(boardLength) => onChange({ boardLength })} />
            <SpecText id={`${listingId}-width`} label="Width" value={spec.boardWidth} disabled={disabled} placeholder={'19 1/4'} onChange={(boardWidth) => onChange({ boardWidth })} />
            <SpecText id={`${listingId}-thickness`} label="Thickness" value={spec.boardThickness} disabled={disabled} placeholder={'2 1/2'} onChange={(boardThickness) => onChange({ boardThickness })} />
            <SpecText id={`${listingId}-volume`} label="Volume (L)" value={spec.boardVolume} disabled={disabled} placeholder="32" onChange={(boardVolume) => onChange({ boardVolume })} />
          </div>
        </div>
      ) : null}

      {facets.map((facet) => (
        <div key={facet.key}>
          <p className="text-[12px] font-medium text-muted-foreground">{facet.label}</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={facet.label}>
            {facet.options.map((option) => {
              const selected = spec[facet.key] === option.value
              return (
                <ChoiceChip
                  key={option.value}
                  selected={selected}
                  disabled={disabled}
                  onClick={() =>
                    onChange({ [facet.key]: selected ? "" : option.value } as Partial<ListingDeskSpec>)
                  }
                >
                  {option.label}
                </ChoiceChip>
              )
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="text-[12px] font-medium text-muted-foreground">Delivery</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Delivery">
          <ChoiceChip
            selected={spec.localPickup}
            disabled={disabled}
            onClick={() => onChange({ localPickup: !spec.localPickup })}
          >
            Local pickup
          </ChoiceChip>
          <ChoiceChip
            selected={spec.shippingAvailable}
            disabled={disabled}
            onClick={() => onChange({ shippingAvailable: !spec.shippingAvailable })}
          >
            Shipping
          </ChoiceChip>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SpecText
          id={`${listingId}-city`}
          label="City"
          value={spec.city}
          disabled={disabled}
          placeholder="City"
          onChange={(city) => onChange({ city })}
        />
        <SpecText
          id={`${listingId}-state`}
          label="State"
          value={spec.state}
          disabled={disabled}
          placeholder="State"
          onChange={(state) => onChange({ state })}
        />
      </div>
    </div>
  )
}

function SpecText({
  id,
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[12px] font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className={cn(quietInputClass, "mt-2")}
      />
    </div>
  )
}
