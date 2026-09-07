"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type PlaygroundKind = "search" | "pricing" | "listing"

export function PublicApiPlayground() {
  const [kind, setKind] = useState<PlaygroundKind>("search")
  const [query, setQuery] = useState("channel islands twin pin")
  const [brand, setBrand] = useState("channel-islands")
  const [model, setModel] = useState("twin-pin")
  const [listingId, setListingId] = useState("")
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<string>("")

  async function runRequest() {
    const path =
      kind === "search"
        ? `/api/public/search?q=${encodeURIComponent(query)}&type=models&limit=5`
        : kind === "pricing"
          ? `/api/public/pricing?brand=${encodeURIComponent(brand)}${model.trim() ? `&model=${encodeURIComponent(model)}` : ""}`
          : `/api/public/listings/${encodeURIComponent(listingId.trim())}`

    setLoading(true)
    try {
      const res = await fetch(path)
      const json: unknown = await res.json()
      setOutput(JSON.stringify(json, null, 2))
    } catch {
      setOutput(JSON.stringify({ error: "Request failed" }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold text-foreground">Try it</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Same-origin requests use your signed-in session for the registered 30/min tier.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["search", "pricing", "listing"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={kind === value ? "default" : "outline"}
            onClick={() => setKind(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {kind === "search" ? (
          <div className="sm:col-span-2">
            <Label htmlFor="public-api-q">Query</Label>
            <Input
              id="public-api-q"
              className="mt-1.5"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        ) : null}
        {kind === "pricing" ? (
          <>
            <div>
              <Label htmlFor="public-api-brand">Brand</Label>
              <Input
                id="public-api-brand"
                className="mt-1.5"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="public-api-model">Model (optional)</Label>
              <Input
                id="public-api-model"
                className="mt-1.5"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </>
        ) : null}
        {kind === "listing" ? (
          <div className="sm:col-span-2">
            <Label htmlFor="public-api-listing">Listing id or slug</Label>
            <Input
              id="public-api-listing"
              className="mt-1.5"
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              placeholder="from search results"
            />
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        className="mt-4"
        onClick={() => void runRequest()}
        disabled={
          loading ||
          (kind === "search" && !query.trim()) ||
          (kind === "pricing" && !brand.trim()) ||
          (kind === "listing" && !listingId.trim())
        }
      >
        {loading ? "Loading…" : "Fetch JSON"}
      </Button>

      {output ? (
        <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed text-foreground">
          {output}
        </pre>
      ) : null}
    </div>
  )
}
