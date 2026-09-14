"use client"

import { useState } from "react"
import { HelpCenterAdditionalResources } from "@/components/features/help-center/help-center-additional-resources"
import { HelpCenterBackBar } from "@/components/features/help-center/help-center-back-bar"
import { HelpCenterHeader } from "@/components/features/help-center/help-center-header"
import { HelpCenterHero } from "@/components/features/help-center/help-center-hero"
import { HelpCenterNeedHelp } from "@/components/features/help-center/help-center-need-help"
import { HelpCenterTopArticles } from "@/components/features/help-center/help-center-top-articles"
import type { HelpCenterTabId } from "@/lib/help-center/types"

export function HelpCenterHome() {
  const [activeTab, setActiveTab] = useState<HelpCenterTabId>("buying")

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <HelpCenterBackBar />
      <HelpCenterHeader />
      <HelpCenterHero activeTab={activeTab} onTabChange={setActiveTab} />
      <HelpCenterTopArticles activeTab={activeTab} />
      <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        <HelpCenterNeedHelp />
      </div>
      <HelpCenterAdditionalResources />
    </div>
  )
}
