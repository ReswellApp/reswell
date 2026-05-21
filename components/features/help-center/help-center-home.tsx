"use client"

import { useState } from "react"
import { HelpCenterAdditionalResources } from "@/components/features/help-center/help-center-additional-resources"
import { HelpCenterBackBar } from "@/components/features/help-center/help-center-back-bar"
import { HelpCenterHeader } from "@/components/features/help-center/help-center-header"
import { HelpCenterHero } from "@/components/features/help-center/help-center-hero"
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
      <HelpCenterAdditionalResources />
    </div>
  )
}
