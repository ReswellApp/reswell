"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Rows3, Settings2, Sparkles } from "lucide-react"
import { EMAIL_STUDIO_FRAMES, type EmailStudioFrameId } from "@/lib/email-studio/frames"
import type { EmailBlockType } from "@/lib/types/emailStudio"
import { cn } from "@/lib/utils"
import { EmailStudioPaletteChip, emailStudioTileLabel } from "@/components/features/admin/email-studio/email-studio-canvas"
import { EmailStudioFrameChip } from "@/components/features/admin/email-studio/email-studio-frame-library"

export type EmailStudioRailTab = "content" | "rows" | "settings" | "assistant"

const GROUPS: { title: string; types: EmailBlockType[] }[] = [
  { title: "Text", types: ["heading", "text", "eyebrow"] },
  { title: "Commerce", types: ["product"] },
  { title: "Media", types: ["image", "logo"] },
  { title: "Button", types: ["button"] },
  { title: "Layout", types: ["section", "split", "details"] },
  { title: "Spacing", types: ["divider", "spacer", "footer"] },
]

const TABS: { id: EmailStudioRailTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "content", label: "Content", icon: LayoutGrid },
  { id: "rows", label: "Rows", icon: Rows3 },
  { id: "settings", label: "Settings", icon: Settings2 },
  { id: "assistant", label: "AI", icon: Sparkles },
]

export function EmailStudioRail({
  tab,
  open,
  inspecting,
  selectedLabel,
  locked,
  paletteGuard,
  blockCount,
  onTab,
  onOpenChange,
  onBack,
  onAddBlock,
  onInsertFrame,
  properties,
  settings,
  assistant,
  structure,
}: {
  tab: EmailStudioRailTab
  open: boolean
  inspecting: boolean
  selectedLabel: string
  locked: boolean
  paletteGuard: { current: boolean }
  blockCount: number
  onTab: (tab: EmailStudioRailTab) => void
  onOpenChange: (open: boolean) => void
  onBack: () => void
  onAddBlock: (type: EmailBlockType) => void
  onInsertFrame: (id: EmailStudioFrameId) => void
  properties: ReactNode
  settings: ReactNode
  assistant: ReactNode
  structure: ReactNode
}) {
  const [query, setQuery] = useState("")
  const [structureOpen, setStructureOpen] = useState(false)
  const needle = query.trim().toLowerCase()
  const groups = GROUPS.map((group) => ({
    title: group.title,
    types: group.types.filter((type) => {
      if (!needle) return true
      return `${emailStudioTileLabel(type)} ${type}`.toLowerCase().includes(needle)
    }),
  })).filter((group) => group.types.length > 0)

  return (
    <aside
      className={cn(
        "relative z-20 flex shrink-0 flex-col border-[#e4e4e7] bg-white",
        open
          ? "h-[46vh] w-full border-t lg:h-auto lg:w-[360px] lg:border-l lg:border-t-0"
          : "h-0 w-full border-0 lg:h-auto lg:w-0",
      )}
    >
      <button
        type="button"
        aria-label={open ? "Hide sidebar" : "Show sidebar"}
        className="absolute -left-3 top-16 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-[#e4e4e7] bg-white text-[#3f3f46] shadow-sm hover:bg-[#f4f4f5] lg:flex"
        onClick={() => onOpenChange(!open)}
      >
        {open ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {open ? (
        inspecting ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[#ececee] px-2">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#3f3f46] hover:bg-[#f4f4f5]"
                aria-label="Back to content blocks"
                onClick={onBack}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="truncate text-sm font-medium text-[#18181b]">{selectedLabel}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{properties}</div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="grid shrink-0 grid-cols-4 border-b border-[#ececee]">
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium",
                      active
                        ? "text-[#2F6FED] shadow-[inset_0_-2px_0_0_#2F6FED]"
                        : "text-[#71717a] hover:text-[#18181b]",
                    )}
                    onClick={() => onTab(id)}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {label}
                  </button>
                )
              })}
            </div>

            {tab === "assistant" ? (
              <div className="min-h-0 flex-1 overflow-hidden p-3">{assistant}</div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "content" ? (
                  <div className={cn("space-y-5", locked && "pointer-events-none opacity-50")}>
                    <input
                      value={query}
                      aria-label="Search content"
                      placeholder="Search content"
                      className="h-9 w-full rounded-md border border-[#e4e4e7] bg-white px-3 text-sm text-[#18181b] outline-none placeholder:text-[#a1a1aa] focus:border-[#2F6FED] focus:ring-2 focus:ring-[#2F6FED]/20"
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    {groups.map((group) => (
                      <section key={group.title}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717a]">
                          {group.title}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {group.types.map((type) => (
                            <EmailStudioPaletteChip
                              key={type}
                              type={type}
                              onActivate={() => {
                                if (paletteGuard.current) {
                                  paletteGuard.current = false
                                  return
                                }
                                onAddBlock(type)
                              }}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                    {needle && groups.length === 0 ? (
                      <p className="text-sm text-[#71717a]">No blocks match that search.</p>
                    ) : null}
                    {!needle ? (
                      <section className="border-t border-[#ececee] pt-4">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717a]"
                          aria-expanded={structureOpen}
                          onClick={() => setStructureOpen((value) => !value)}
                        >
                          Layers
                          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                            <span className="text-[11px] font-medium">{blockCount}</span>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition", structureOpen && "rotate-180")} />
                          </span>
                        </button>
                        {structureOpen ? <div className="mt-3">{structure}</div> : null}
                      </section>
                    ) : null}
                  </div>
                ) : null}

                {tab === "rows" ? (
                  <div className={cn("space-y-3", locked && "pointer-events-none opacity-50")}>
                    <p className="text-xs leading-relaxed text-[#71717a]">
                      Rows hold the layout. Drag one onto the stage, then drop content inside it.
                    </p>
                    <div className="grid gap-2">
                      {EMAIL_STUDIO_FRAMES.map((frame) => (
                        <EmailStudioFrameChip
                          key={frame.id}
                          id={frame.id}
                          onActivate={() => {
                            if (paletteGuard.current) {
                              paletteGuard.current = false
                              return
                            }
                            onInsertFrame(frame.id)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {tab === "settings" ? settings : null}
              </div>
            )}
          </div>
        )
      ) : (
        <button
          type="button"
          className="absolute bottom-4 right-4 rounded-full bg-[#18181b] px-3 py-2 text-xs font-medium text-white shadow-lg lg:hidden"
          onClick={() => onOpenChange(true)}
        >
          Blocks
        </button>
      )}
    </aside>
  )
}
