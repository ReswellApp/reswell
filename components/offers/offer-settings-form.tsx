'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { OfferSettings } from '@/lib/offers/types'

interface OfferSettingsFormProps {
  listingId: string
  askingPrice: number
  initialSettings: Partial<OfferSettings> | null
}

export function OfferSettingsForm({
  listingId,
  askingPrice,
  initialSettings,
}: OfferSettingsFormProps) {
  const [offersEnabled, setOffersEnabled] = useState(
    initialSettings?.offers_enabled ?? true
  )
  const [minimumOfferPct, setMinimumOfferPct] = useState(
    initialSettings?.minimum_offer_pct ?? 70
  )
  const [autoAcceptAbove, setAutoAcceptAbove] = useState(
    initialSettings?.auto_accept_above?.toString() ?? ''
  )
  const [autoDeclineBelow, setAutoDeclineBelow] = useState(
    initialSettings?.auto_decline_below?.toString() ?? ''
  )

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minOfferAmt = Math.ceil(askingPrice * (minimumOfferPct / 100) * 100) / 100

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const supabase = createClient()

    const payload = {
      listing_id: listingId,
      offers_enabled: offersEnabled,
      minimum_offer_pct: minimumOfferPct,
      auto_accept_above: autoAcceptAbove ? parseFloat(autoAcceptAbove) : null,
      auto_decline_below: autoDeclineBelow ? parseFloat(autoDeclineBelow) : null,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertErr } = await supabase
      .from('offer_settings')
      .upsert(payload, { onConflict: 'listing_id' })

    setSaving(false)

    if (upsertErr) {
      setError('Failed to save offer settings.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Enable / Disable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="offers-enabled" className="text-sm font-medium">
            Accept offers on this listing
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Show a &ldquo;Make an offer&rdquo; button on your listing
          </p>
        </div>
        <Switch
          id="offers-enabled"
          checked={offersEnabled}
          onCheckedChange={setOffersEnabled}
        />
      </div>

      {offersEnabled && (
        <>
          {/* Minimum offer % slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Minimum offer</Label>
              <span className="text-sm font-bold tabular-nums">
                {minimumOfferPct}% — ${minOfferAmt.toFixed(2)}
              </span>
            </div>
            <Slider
              min={50}
              max={90}
              step={5}
              value={[minimumOfferPct]}
              onValueChange={([v]) => setMinimumOfferPct(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50% (most flexible)</span>
              <span>90% (near asking)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Offers below this percentage are automatically declined.
            </p>
          </div>

          {/* Auto-accept */}
          <div className="space-y-2">
            <Label htmlFor="auto-accept" className="text-sm font-medium">
              Auto-accept above{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                id="auto-accept"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={askingPrice}
                value={autoAcceptAbove}
                onChange={(e) => setAutoAcceptAbove(e.target.value)}
                placeholder={`e.g. ${(askingPrice * 0.9).toFixed(2)}`}
                className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically accept any offer at or above this amount.
            </p>
          </div>

          {/* Auto-decline */}
          <div className="space-y-2">
            <Label htmlFor="auto-decline" className="text-sm font-medium">
              Auto-decline below{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                id="auto-decline"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={autoDeclineBelow}
                onChange={(e) => setAutoDeclineBelow(e.target.value)}
                placeholder={`e.g. ${(askingPrice * 0.6).toFixed(2)}`}
                className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically decline any offer below this amount without notifying you.
            </p>
          </div>
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Offer settings saved.
        </div>
      )}

      <Button onClick={save} disabled={saving} size="sm">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save offer settings
      </Button>
    </div>
  )
}
