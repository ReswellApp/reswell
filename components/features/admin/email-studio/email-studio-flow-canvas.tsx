"use client"

import { useMemo } from "react"
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
} from "@/lib/email-studio/flow-layout"
import { flowStepLabel } from "@/lib/email-studio/flow-definition"
import { cn } from "@/lib/utils"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowStep,
} from "@/lib/types/emailStudioFlow"
import { Button } from "@/components/ui/button"

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
  if (step.type === "split") return step.mode.replaceAll("-", " ")
  if (step.type === "webhook") return step.url || "Add a URL"
  if (step.type === "update-profile") return `${step.property || "Property"} = ${step.value || "value"}`
  if (step.type === "list-update") return step.listId || "Choose a list"
  return "Continue after the delay"
}

export function EmailStudioFlowCanvas({
  definition,
  selectedId,
  projects,
  onSelect,
}: {
  definition: EmailStudioFlowDefinition
  selectedId: string | null
  projects: { id: string; name: string }[]
  onSelect: (id: string | null) => void
}) {
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
                </svg>
                {layout.nodes.map((node) => {
                  const Icon = iconFor(node.step)
                  const selected = node.step?.id === selectedId
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={cn(
                        "flow-node absolute flex items-start gap-3 rounded-xl border bg-background p-3 text-left",
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
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {node.step ? flowStepLabel(node.step) : "Trigger"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                          {subtitle(node.step, projectNames, triggerLabel)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  )
}
