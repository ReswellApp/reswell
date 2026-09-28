import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AdsPmaxCreateFields } from "@/components/features/admin/ads-manager/ads-pmax-create-fields"
import { AdsField, AdsSelect } from "@/components/features/admin/ads-manager/ads-manager-ui"

export interface GoogleDraft {
  campaignKind: "search" | "pmax"
  name: string
  dailyBudget: string
  maxCpc: string
  finalUrl: string
  headlines: string
  descriptions: string
  keywords: string
  longHeadlines: string
  businessName: string
  marketingImage: string
  squareImage: string
  logo: string
  youtube: string
}

export const EMPTY_GOOGLE_DRAFT: GoogleDraft = {
  campaignKind: "search",
  name: "",
  dailyBudget: "50",
  maxCpc: "1",
  finalUrl: "https://www.reswell.app",
  headlines: "",
  descriptions: "",
  keywords: "",
  longHeadlines: "",
  businessName: "",
  marketingImage: "",
  squareImage: "",
  logo: "",
  youtube: "",
}

export function AdsGoogleCreateFields({
  draft,
  onChange,
}: {
  draft: GoogleDraft
  onChange: (draft: GoogleDraft) => void
}) {
  const set = (patch: Partial<GoogleDraft>) => onChange({ ...draft, ...patch })
  const pmax = draft.campaignKind === "pmax"
  return (
    <div className="grid gap-3">
      <AdsField label="Campaign type">
        <AdsSelect
          value={draft.campaignKind}
          onChange={(value) => set({ campaignKind: value === "pmax" ? "pmax" : "search" })}
          options={[
            { value: "search", label: "Search" },
            { value: "pmax", label: "Performance Max" },
          ]}
        />
      </AdsField>
      <AdsField label="Campaign name">
        <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </AdsField>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Daily budget" hint="Account currency. Created paused.">
          <Input value={draft.dailyBudget} inputMode="decimal" onChange={(event) => set({ dailyBudget: event.target.value })} />
        </AdsField>
        {pmax ? null : (
          <AdsField label="Max CPC">
            <Input value={draft.maxCpc} inputMode="decimal" onChange={(event) => set({ maxCpc: event.target.value })} />
          </AdsField>
        )}
      </div>
      <AdsField label="Final URL">
        <Input value={draft.finalUrl} onChange={(event) => set({ finalUrl: event.target.value })} />
      </AdsField>
      <AdsField label="Headlines" hint="One per line. 3 to 15, 30 characters each.">
        <Textarea value={draft.headlines} onChange={(event) => set({ headlines: event.target.value })} />
      </AdsField>
      <AdsField label="Descriptions" hint={pmax ? "One per line. 2 to 5, 90 characters each." : "One per line. 2 to 4, 90 characters each."}>
        <Textarea value={draft.descriptions} onChange={(event) => set({ descriptions: event.target.value })} />
      </AdsField>
      {pmax ? (
        <AdsPmaxCreateFields draft={draft} onChange={onChange} />
      ) : (
        <AdsField label="Keywords" hint="Optional. One phrase-match keyword per line.">
          <Textarea value={draft.keywords} onChange={(event) => set({ keywords: event.target.value })} />
        </AdsField>
      )}
    </div>
  )
}

export function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean)
}
