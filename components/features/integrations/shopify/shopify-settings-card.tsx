"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface ShopifyChannelSettingsValue {
  sync_mode: string
  sync_tags: string[]
  auto_sync_enabled: boolean
  pricing_mode: string
  markup_percent: number
}

interface ShopifySettingsCardProps {
  value: ShopifyChannelSettingsValue
  onSaved: () => void
}

export function ShopifySettingsCard({ value, onSaved }: ShopifySettingsCardProps) {
  const [syncMode, setSyncMode] = useState(value.sync_mode)
  const [autoSync, setAutoSync] = useState(value.auto_sync_enabled)
  const [pricingMode, setPricingMode] = useState(value.pricing_mode)
  const [markup, setMarkup] = useState(String(value.markup_percent ?? 0))
  const [tags, setTags] = useState(value.sync_tags.join(", "))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/integrations/shopify/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sync_mode: syncMode,
          auto_sync_enabled: autoSync,
          pricing_mode: pricingMode,
          markup_percent: Number(markup) || 0,
          sync_tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: unknown }
        toast.error(typeof json.error === "string" ? json.error : "Could not save settings")
        return
      }
      toast.success("Channel settings saved")
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sync settings</CardTitle>
        <CardDescription>Control which products auto-import and how they&apos;re priced.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Auto-import mode</Label>
            <Select value={syncMode} onValueChange={setSyncMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual — I pick products</SelectItem>
                <SelectItem value="all">All products</SelectItem>
                <SelectItem value="tags">Products with matching tags</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pricing</Label>
            <Select value={pricingMode} onValueChange={setPricingMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mirror">Mirror Shopify price</SelectItem>
                <SelectItem value="markup">Add markup %</SelectItem>
                <SelectItem value="compare_at">Use compare-at price</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {syncMode === "tags" ? (
          <div className="space-y-2">
            <Label htmlFor="sync-tags">Sync tags (comma-separated)</Label>
            <Input
              id="sync-tags"
              placeholder="reswell, marketplace"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        ) : null}

        {pricingMode === "markup" ? (
          <div className="space-y-2 sm:w-40">
            <Label htmlFor="markup">Markup %</Label>
            <Input
              id="markup"
              type="number"
              min={0}
              max={500}
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Keep listings in sync automatically</p>
            <p className="text-xs text-muted-foreground">
              Apply product, price, and inventory changes from Shopify in real time.
            </p>
          </div>
          <Switch checked={autoSync} onCheckedChange={setAutoSync} />
        </div>

        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save settings
        </Button>
      </CardContent>
    </Card>
  )
}
