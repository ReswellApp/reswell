"use client"

import { useDraggable } from "@dnd-kit/core"
import { EMAIL_STUDIO_FRAMES, type EmailStudioFrameId } from "@/lib/email-studio/frames"
import { cn } from "@/lib/utils"

function FrameThumb({ id }: { id: EmailStudioFrameId }) {
  if (id === "editorial") {
    return (
      <div className="grid h-14 grid-cols-[1.4fr_1fr] gap-1 rounded bg-white p-1.5">
        <div className="space-y-1">
          <div className="h-1.5 w-8 rounded-full bg-[#0F172A]" />
          <div className="h-1 w-full rounded-full bg-[#E2E8F0]" />
          <div className="h-1 w-4/5 rounded-full bg-[#E2E8F0]" />
        </div>
        <div className="rounded bg-[#F9F9F2]" />
      </div>
    )
  }
  if (id === "features") {
    return (
      <div className="grid h-14 grid-cols-3 gap-1 rounded bg-[#F9F9F2] p-1.5">
        <div className="rounded bg-white" />
        <div className="rounded bg-white" />
        <div className="rounded bg-white" />
      </div>
    )
  }
  if (id === "spotlight") {
    return (
      <div className="grid h-14 grid-cols-2 gap-1 rounded bg-white p-1.5">
        <div className="rounded bg-[#E2E8F0]" />
        <div className="space-y-1 pt-1">
          <div className="h-1.5 w-8 rounded-full bg-[#0F172A]" />
          <div className="h-3 w-10 rounded bg-[#5574AD]" />
        </div>
      </div>
    )
  }
  if (id === "receipt") {
    return (
      <div className="flex h-14 flex-col justify-center gap-1 rounded border border-[#E2E8F0] bg-white p-1.5">
        <div className="h-1 w-full rounded-full bg-[#E2E8F0]" />
        <div className="h-1 w-full rounded-full bg-[#E2E8F0]" />
        <div className="h-1 w-2/3 rounded-full bg-[#E2E8F0]" />
      </div>
    )
  }
  if (id === "quote") {
    return (
      <div className="flex h-14 items-center justify-center rounded bg-[#F9F9F2] px-2">
        <div className="h-1.5 w-16 rounded-full bg-[#0F172A]" />
      </div>
    )
  }
  return (
    <div className={cn("flex h-14 flex-col justify-center gap-1 rounded px-2", id === "closer" || id === "hero" ? "bg-[#0F172A]" : "bg-[#F9F9F2]")}>
      <div className={cn("mx-auto h-1 w-8 rounded-full", id === "closer" || id === "hero" ? "bg-white/80" : "bg-[#0F172A]")} />
      <div className={cn("mx-auto h-1 w-12 rounded-full", id === "closer" || id === "hero" ? "bg-white/40" : "bg-[#E2E8F0]")} />
      {id === "closer" ? <div className="mx-auto mt-1 h-2 w-8 rounded bg-[#5574AD]" /> : null}
    </div>
  )
}

export function EmailStudioFrameChip({ id }: { id: EmailStudioFrameId }) {
  const frame = EMAIL_STUDIO_FRAMES.find((item) => item.id === id)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `frame:${id}` })
  if (!frame) return null
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "w-full cursor-grab rounded-md border border-border bg-background p-1.5 text-left active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
      {...attributes}
      {...listeners}
    >
      <FrameThumb id={id} />
      <span className="mt-1 block text-xs font-medium">{frame.name}</span>
      <span className="block text-[10px] leading-snug text-muted-foreground">{frame.blurb}</span>
    </button>
  )
}
