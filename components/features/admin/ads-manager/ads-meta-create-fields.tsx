import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"

export interface MetaDraft {
  name: string
  objective: "traffic" | "sales"
  dailyBudget: string
  countries: string
  finalUrl: string
  primaryText: string
  headline: string
  description: string
  imageUrl: string
}

export const EMPTY_META_DRAFT: MetaDraft = {
  name: "",
  objective: "traffic",
  dailyBudget: "50",
  countries: "US",
  finalUrl: "https://www.reswell.app",
  primaryText: "",
  headline: "",
  description: "",
  imageUrl: "",
}

export function AdsMetaCreateFields({
  draft,
  onChange,
}: {
  draft: MetaDraft
  onChange: (draft: MetaDraft) => void
}) {
  const set = (patch: Partial<MetaDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="grid gap-3">
      <AdsField label="Campaign name">
        <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </AdsField>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Objective">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={draft.objective}
            onChange={(event) => set({ objective: event.target.value === "sales" ? "sales" : "traffic" })}
          >
            <option value="traffic">Traffic</option>
            <option value="sales">Sales</option>
          </select>
        </AdsField>
        <AdsField label="Daily budget" hint="Created paused.">
          <Input value={draft.dailyBudget} inputMode="decimal" onChange={(event) => set({ dailyBudget: event.target.value })} />
        </AdsField>
      </div>
      <AdsField label="Countries" hint="ISO codes, comma separated.">
        <Input value={draft.countries} onChange={(event) => set({ countries: event.target.value })} />
      </AdsField>
      <AdsField label="Website URL">
        <Input value={draft.finalUrl} onChange={(event) => set({ finalUrl: event.target.value })} />
      </AdsField>
      <AdsField label="Primary text">
        <Textarea value={draft.primaryText} onChange={(event) => set({ primaryText: event.target.value })} />
      </AdsField>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Headline" hint="40 characters.">
          <Input value={draft.headline} onChange={(event) => set({ headline: event.target.value })} />
        </AdsField>
        <AdsField label="Description" hint="Optional, 30 characters.">
          <Input value={draft.description} onChange={(event) => set({ description: event.target.value })} />
        </AdsField>
      </div>
      <AdsField label="Image URL" hint="https image Meta can fetch.">
        <Input value={draft.imageUrl} onChange={(event) => set({ imageUrl: event.target.value })} />
      </AdsField>
    </div>
  )
}
