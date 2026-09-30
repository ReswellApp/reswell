"use client"

import { useState, type ReactNode } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { EMAIL_MERGE_TOKENS } from "@/lib/email-studio/tokens"
import type { EmailHideOn, EmailPadding } from "@/lib/types/emailStudio"
import { cn } from "@/lib/utils"

export function PropertySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="bg-[#f3f4f6] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#52525b]">
        {title}
      </h3>
      <div className="divide-y divide-[#f0f0f2] px-4">{children}</div>
    </section>
  )
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-[#3f3f46]">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number
  min: number
  max: number
  label: string
  onChange: (value: number) => void
}) {
  return (
    <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-[#e4e4e7] bg-white">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="h-8 w-7 text-sm text-[#3f3f46] hover:bg-[#f4f4f5]"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="w-8 text-center text-sm tabular-nums text-[#18181b]">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="h-8 w-7 text-sm text-[#3f3f46] hover:bg-[#f4f4f5]"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}

export function ColorField({
  value,
  fallback,
  label,
  onChange,
}: {
  value?: string
  fallback: string
  label: string
  onChange: (value: string) => void
}) {
  const shown = (value ?? fallback).toLowerCase()
  return (
    <label className="inline-flex items-center gap-2">
      <input
        aria-label={label}
        type="color"
        value={shown}
        className="h-7 w-9 cursor-pointer rounded border border-[#e4e4e7] bg-white p-0.5"
        onChange={(event) => onChange(event.target.value.toLowerCase())}
      />
      <span className="font-mono text-xs text-[#3f3f46]">{shown}</span>
    </label>
  )
}

export function PurpleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      className={cn("relative h-6 w-11 rounded-full transition", checked ? "bg-[#7C5CFC]" : "bg-[#e4e4e7]")}
      onClick={() => onChange(!checked)}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow",
          checked ? "left-5" : "left-0.5",
        )}
      />
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  label,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  label: string
  onChange: (value: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-[#e4e4e7]">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center px-2.5 text-xs font-semibold",
              active ? "bg-[#7C5CFC] text-white" : "bg-white text-[#3f3f46] hover:bg-[#f4f4f5]",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

const selectClass = "h-9 rounded-md border border-[#e4e4e7] bg-white px-2 text-sm text-[#18181b]"

export function HideOnField({
  value,
  onChange,
}: {
  value?: EmailHideOn
  onChange: (value: EmailHideOn | undefined) => void
}) {
  return (
    <PropertyRow label="Hide on">
      <Segmented
        label="Hide on"
        value={value ?? "off"}
        onChange={(next) => onChange(next === "off" ? undefined : next)}
        options={[
          { value: "off", label: "Off" },
          { value: "desktop", label: <Monitor className="h-3.5 w-3.5" /> },
          { value: "mobile", label: <Smartphone className="h-3.5 w-3.5" /> },
        ]}
      />
    </PropertyRow>
  )
}

export function PaddingFields({
  value,
  onChange,
}: {
  value?: EmailPadding
  onChange: (value: EmailPadding) => void
}) {
  const current = value ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const mixed = current.top !== current.right || current.right !== current.bottom || current.bottom !== current.left
  const [more, setMore] = useState(mixed)

  function setSide(side: keyof EmailPadding, next: number) {
    onChange({ ...current, [side]: next })
  }

  return (
    <div className="space-y-2 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[#3f3f46]">Padding</span>
        <span className="inline-flex items-center gap-2 text-sm text-[#3f3f46]">
          More options
          <PurpleSwitch checked={more} label="Padding on each side" onChange={setMore} />
        </span>
      </div>
      {more ? (
        <div className="grid grid-cols-2 gap-3">
          <SideStepper label="Top" value={current.top} onChange={(next) => setSide("top", next)} />
          <SideStepper label="Right" value={current.right} onChange={(next) => setSide("right", next)} />
          <SideStepper label="Bottom" value={current.bottom} onChange={(next) => setSide("bottom", next)} />
          <SideStepper label="Left" value={current.left} onChange={(next) => setSide("left", next)} />
        </div>
      ) : (
        <div className="flex justify-end">
          <Stepper
            label="Padding"
            min={0}
            max={120}
            value={current.top}
            onChange={(next) => onChange({ top: next, right: next, bottom: next, left: next })}
          />
        </div>
      )}
    </div>
  )
}

function SideStepper({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-[#71717a]">{label}</span>
      <Stepper label={label} min={0} max={120} value={value} onChange={onChange} />
    </label>
  )
}

export function LinkFields({
  href,
  onChange,
}: {
  href: string
  onChange: (href: string) => void
}) {
  const kind = href.trim().toLowerCase().startsWith("mailto:") ? "email" : "web"
  const [tokensOpen, setTokensOpen] = useState(false)

  return (
    <>
      <div className="space-y-2 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[#3f3f46]">Link type</span>
          <select
            aria-label="Link type"
            className={selectClass}
            value={kind}
            onChange={(event) => {
              if (event.target.value === "email") {
                const bare = href.replace(/^mailto:/i, "").replace(/^https?:\/\//i, "")
                onChange(bare.includes("@") ? `mailto:${bare}` : "mailto:")
                return
              }
              onChange(href.replace(/^mailto:/i, ""))
            }}
          >
            <option value="web">Open web page</option>
            <option value="email">Email address</option>
          </select>
        </div>
        <div className="flex h-9 overflow-hidden rounded-md border border-[#e4e4e7]">
          <span className="flex items-center border-r border-[#e4e4e7] bg-[#fafafa] px-2 text-xs text-[#71717a]">
            {kind === "email" ? "To" : "Url"}
          </span>
          <input
            aria-label={kind === "email" ? "Email address" : "Url"}
            value={href}
            className="min-w-0 flex-1 bg-white px-2 text-sm text-[#18181b] outline-none"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="text-sm font-medium text-[#7C5CFC] hover:underline"
          onClick={() => setTokensOpen((open) => !open)}
        >
          Special links
        </button>
        {tokensOpen ? (
          <select
            aria-label="Special links"
            className={`${selectClass} w-full`}
            value=""
            onChange={(event) => {
              if (!event.target.value) return
              onChange(event.target.value)
              setTokensOpen(false)
            }}
          >
            <option value="">Insert a Klaviyo tag</option>
            {EMAIL_MERGE_TOKENS.map((token) => (
              <option key={token.value} value={token.value}>
                {token.group}: {token.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </>
  )
}

export { selectClass as propertySelectClass }
