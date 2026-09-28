import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AdsField } from "@/components/features/admin/ads-manager/ads-manager-ui"

export interface GoogleDraft {
  name: string
  dailyBudget: string
  maxCpc: string
  finalUrl: string
  headlines: string
  descriptions: string
  keywords: string
}

export const EMPTY_GOOGLE_DRAFT: GoogleDraft = {
  name: "",
  dailyBudget: "50",
  maxCpc: "1",
  finalUrl: "https://www.reswell.app",
  headlines: "",
  descriptions: "",
  keywords: "",
}

export function AdsGoogleCreateFields({
  draft,
  onChange,
}: {
  draft: GoogleDraft
  onChange: (draft: GoogleDraft) => void
}) {
  const set = (patch: Partial<GoogleDraft>) => onChange({ ...draft, ...patch })
  return (
    <div className="grid gap-3">
      <AdsField label="Campaign name">
        <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      </AdsField>
      <div className="grid gap-3 sm:grid-cols-2">
        <AdsField label="Daily budget" hint="Account currency. Created paused.">
          <Input value={draft.dailyBudget} inputMode="decimal" onChange={(event) => set({ dailyBudget: event.target.value })} />
        </AdsField>
        <AdsField label="Max CPC">
          <Input value={draft.maxCpc} inputMode="decimal" onChange={(event) => set({ maxCpc: event.target.value })} />
        </AdsField>
      </div>
      <AdsField label="Final URL">
        <Input value={draft.finalUrl} onChange={(event) => set({ finalUrl: event.target.value })} />
      </AdsField>
      <AdsField label="Headlines" hint="One per line. 3 to 15, 30 characters each.">
        <Textarea value={draft.headlines} onChange={(event) => set({ headlines: event.target.value })} />
      </AdsField>
      <AdsField label="Descriptions" hint="One per line. 2 to 4, 90 characters each.">
        <Textarea value={draft.descriptions} onChange={(event) => set({ descriptions: event.target.value })} />
      </AdsField>
      <AdsField label="Keywords" hint="Optional. One phrase-match keyword per line.">
        <Textarea value={draft.keywords} onChange={(event) => set({ keywords: event.target.value })} />
      </AdsField>
    </div>
  )
}

export function lines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean)
}
