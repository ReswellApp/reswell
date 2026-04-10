"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type BoardsListingsSearchFieldProps = {
  value: string
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  inputClassName?: string
  className?: string
}

/**
 * Surfboards browse: free-text keyword filter (`q`). Server matches title, description,
 * board details, categories, and brand — no client-side suggestion layer.
 */
export function BoardsListingsSearchField({
  value,
  onChange,
  name = "q",
  placeholder = "Search title, details, brand…",
  inputClassName = "",
  className = "",
}: BoardsListingsSearchFieldProps) {
  return (
    <div className={cn("w-full min-w-0", className)}>
      <Input
        type="search"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={inputClassName}
      />
    </div>
  )
}
