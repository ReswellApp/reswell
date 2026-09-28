"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createMetaSavedAudienceAction, type AdsActionResult } from "@/lib/actions/adsManager"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"

export function AdsSavedAudienceForm({ onDone }: { onDone: (result: AdsActionResult) => void }) {
  const [name, setName] = useState("")
  const [countries, setCountries] = useState("US")
  const [ageMin, setAgeMin] = useState("18")
  const [ageMax, setAgeMax] = useState("65")
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    const result = await createMetaSavedAudienceAction({
      name,
      countries: countries.split(",").map((code) => code.trim().toUpperCase()).filter(Boolean),
      ageMin: Number(ageMin),
      ageMax: Number(ageMax),
    })
    setPending(false)
    onDone(result)
  }

  return (
    <div className="grid gap-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium">New Meta saved audience</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </AdsField>
        <AdsField label="Countries" hint="ISO codes, comma separated.">
          <Input value={countries} onChange={(event) => setCountries(event.target.value)} />
        </AdsField>
        <AdsField label="Minimum age">
          <Input value={ageMin} inputMode="numeric" onChange={(event) => setAgeMin(event.target.value)} />
        </AdsField>
        <AdsField label="Maximum age">
          <Input value={ageMax} inputMode="numeric" onChange={(event) => setAgeMax(event.target.value)} />
        </AdsField>
      </div>
      <Button type="button" size="sm" disabled={pending} onClick={() => void submit()}>
        {pending ? "Creating…" : "Create saved audience"}
      </Button>
    </div>
  )
}
