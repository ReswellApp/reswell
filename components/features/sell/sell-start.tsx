"use client"

import * as React from "react"
import { SellCatalogSearch } from "@/components/features/sell/sell-catalog-search"
import { SellTypeChooser } from "@/components/features/sell/sell-type-chooser"

/**
 * `/sell` entry: catalog search wall first; "List manually" reveals the
 * product-type chooser blocks.
 */
export function SellStart({ isAdmin = false }: { isAdmin?: boolean }) {
  const [mode, setMode] = React.useState<"search" | "choose">("search")

  if (mode === "choose") {
    return (
      <SellTypeChooser isAdmin={isAdmin} onBackToSearch={() => setMode("search")} />
    )
  }
  return <SellCatalogSearch onSkip={() => setMode("choose")} />
}
