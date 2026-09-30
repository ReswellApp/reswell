"use client"

import { useMemo, useState } from "react"
import {
  GitBranch,
  Mail,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Timer,
  Webhook,
  Zap,
} from "lucide-react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import {
  FLOW_NODE_HEIGHT,
  FLOW_NODE_WIDTH,
  layoutEmailStudioFlow,
  type FlowInsertAnchor,
} from "@/lib/email-studio/flow-layout"
import { flowStepLabel } from "@/lib/email-studio/flow-definition"
import { cn } from "@/lib/utils"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowStep,
} from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"

const ACTIONS: { type: EmailStudioFlowStep["type"]; label: string }[] = [
  { type: "delay", label: "Time delay" },
  { type: "email", label: "Email" },
  { type: "sms", label: "SMS" },
  { type: "split", label: "Conditional split" },
  { type: "update-profile", label: "Update profile" },
  { type: "list-update", label: "List update" },
  { type: "webhook", label: "Webhook" },
]

function iconFor(step: EmailStudioFlowStep | null) {
  if (!step) return Zap
  if (step.type === "delay") return Timer
  if (step.type === "email") return Mail
  if (step.type === "sms") return MessageSquare
  if (step.type === "split") return GitBranch
  if (step.type === "webhook") return Webhook
  return Zap
}

function subtitle(
  step: EmailStudioFlowStep | null,
  projects: Map<string, string>,
  triggerLabel: string,
): string {
  if (!step) return triggerLabel || "Choose a trigger"
  if (step.type === "email") return projects.get(step.projectId) ?? "Choose an email"
  if (step.type === "sms") return step.body || "Write the message"
  if (step.type === "split") {
    if (step.mode === "email-subscribed") return "Can receive email"
    return `${step.property || (step.mode === "event-property" ? "Event property" : "Profile property")} ${step.operator.replaceAll("-", " ")} ${step.value || "value"}`
  }
  if (step.type === "webhook") return step.url || "Add a URL"
  if (step.type === "update-profile") return `${step.property || "Property"} = ${step.value || "value"}`
  if (step.type === "list-update") return step.listId || "Choose a list"
  return `Wait ${step.value} ${step.unit}`
}

function triggerTitle(definition: EmailStudioFlowDefinition): string {
  if (definition.trigger.type === "metric") return "Metric trigger"
  if (definition.trigger.type === "list") return "List trigger"
  if (definition.trigger.type === "segment") return "Segment trigger"
  return "Date property trigger"
}

export function EmailStudioFlowCanvas({
  definition,
  selectedId,
  projects,
  onSelect,
  onInsert,
  disabled = false,
}: {
  definition: EmailStudioFlowDefinition
  selectedId: string | null
  projects: { id: string; name: string }[]
  onSelect: (id: string | null) => void
  onInsert: (anchor: FlowInsertAnchor, type: EmailStudioFlowStep["type"]) => void
  disabled?: boolean
}) {
  const [openInsertionId, setOpenInsertionId] = useState<string | null>(null)
  const layout = useMemo(() => layoutEmailStudioFlow(definition), [definition])
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  )
  const trigger = definition.trigger
  const triggerLabel = trigger.type === "metric"
    ? trigger.metricName
    : trigger.type === "list"
      ? trigger.listName
      : trigger.type === "segment"
        ? trigger.segmentName
        : trigger.property

  return (
    <div className="relative min-h-[560px] flex-1 overflow-hidden bg-[#F6F7F3]">
      <TransformWrapper
        initialScale={0.9}
        minScale={0.45}
        maxScale={1.5}
        centerOnInit
        centerZoomedOut
        limitToBounds={false}
        panning={{ excluded: ["flow-node"] }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <div className="absolute left-3 top-3 z-20 flex rounded-md border border-border bg-background p-1">
              <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => zoomIn()}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => zoomOut()}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Reset canvas" onClick={() => resetTransform()}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="min-h-full min-w-full"
              wrapperStyle={{ minHeight: 560 }}
            >
              <div className="relative" style={{ width: layout.width, height: layout.height }}>
                <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height}>
                  {layout.edges.map((edge) => {
                    const middle = (edge.sourceY + edge.targetY) / 2
                    return (
                      <g key={edge.id}>
                        <path
                          d={`M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX} ${middle}, ${edge.targetX} ${middle}, ${edge.targetX} ${edge.targetY}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-border"
                        />
                        {edge.label ? (
                          <text
                            x={(edge.sourceX + edge.targetX) / 2}
                            y={middle - 6}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[11px]"
                          >
                            {edge.label}
                          </text>
                        ) : null}
                      </g>
                    )
                  })}
                  {layout.insertionPoints.map((point) => (
                    <g key={point.id}>
                      <path
                        d={`M ${point.sourceX} ${point.sourceY} C ${point.sourceX} ${point.y - 20}, ${point.x} ${point.y - 20}, ${point.x} ${point.y}`}
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray="4 4"
                        strokeWidth="2"
                        className="text-border"
                      />
                      {point.label ? (
                        <text
                          x={(point.sourceX + point.x) / 2}
                          y={point.y - 24}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[11px]"
                        >
                          {point.label}
                        </text>
                      ) : null}
                    </g>
                  ))}
                </svg>
                {layout.nodes.map((node) => {
                  const Icon = iconFor(node.step)
                  const selected = node.step ? node.step.id === selectedId : selectedId === null
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={cn(
                        "flow-node absolute flex items-start gap-3 rounded-xl border bg-background p-3 text-left shadow-sm transition hover:border-[#5574AD]/50 hover:shadow-md",
                        selected ? "border-[#5574AD] ring-2 ring-[#5574AD]/20" : "border-border",
                      )}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: FLOW_NODE_WIDTH,
                        height: FLOW_NODE_HEIGHT,
                      }}
                      onClick={() => onSelect(node.step?.id ?? null)}
                    >
                      <span className="rounded-md bg-muted p-1.5 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block min-w-0 flex-1 truncate text-sm font-medium">
                            {node.step ? flowStepLabel(node.step) : triggerTitle(definition)}
                          </span>
                          {node.step?.type === "email" ? (
                            <span className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
                              node.step.status === "draft"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700",
                            )}>
                              {node.step.status === "draft" ? "Draft" : "Ready"}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                          {subtitle(node.step, projectNames, triggerLabel)}
                        </span>
                        {!node.step ? (
                          <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                            {definition.profileFilter.type === "email-subscribed"
                              ? "Email subscribers"
                              : definition.profileFilter.type === "none"
                                ? "No entry filter"
                                : `${definition.profileFilter.property || "Property"} equals ${definition.profileFilter.value || "value"}`}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
                {layout.insertionPoints.map((point) => (
                  <div
                    key={point.id}
                    className="flow-node absolute z-10"
                    style={{ left: point.x - 18, top: point.y - 18 }}
                  >
                    <button
                      type="button"
                      aria-label={point.label ? `Add action to ${point.label.toLowerCase()} path` : "Add action"}
                      disabled={disabled}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#5574AD]/40 bg-white text-[#355185] shadow-sm transition hover:scale-105 hover:border-[#5574AD] hover:shadow-md disabled:opacity-50"
                      onClick={() => setOpenInsertionId((current) => current === point.id ? null : point.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {openInsertionId === point.id ? (
                      <div className="absolute left-11 top-0 w-48 overflow-hidden rounded-lg border border-border bg-background p-1 shadow-xl">
                        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          Add action
                        </p>
                        {ACTIONS.map((action) => (
                          <button
                            key={action.type}
                            type="button"
                            className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                            onClick={() => {
                              onInsert(point.anchor, action.type)
                              setOpenInsertionId(null)
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
