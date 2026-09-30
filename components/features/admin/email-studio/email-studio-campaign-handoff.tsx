"use client"

import { ExternalLink } from "lucide-react"
import { KLAVIYO_CAMPAIGNS_URL } from "@/lib/klaviyo/web-links"
import { Button } from "@/components/ui/button"

export function EmailStudioCampaignHandoff({ projectName }: { projectName: string }) {
  const templateName = `Reswell · ${projectName}`.slice(0, 255)
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-emerald-900">Template ready for a campaign</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">
          In Klaviyo, create an email campaign, choose the audience, select <strong>{templateName}</strong> from saved templates, then schedule it.
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 bg-white" asChild>
        <a href={KLAVIYO_CAMPAIGNS_URL} target="_blank" rel="noreferrer">
          Continue in Klaviyo
          <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </a>
      </Button>
    </div>
  )
}
