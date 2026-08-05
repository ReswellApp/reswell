"use client"

// Temporary manual-test harness for SellFinsCatalogSearch dropdown behavior.
// DELETE THIS FILE — not part of the product.

import { SellFinsCatalogSearch } from "@/components/features/sell/sell-fins-catalog-search"

export default function DevFinsSearchTestPage() {
  return (
    <SellFinsCatalogSearch
      onSelect={(selection) => console.log("selected", selection)}
      onSkip={() => console.log("skip")}
    />
  )
}
