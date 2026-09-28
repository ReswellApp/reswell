import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowStep,
} from "@/lib/types/emailStudioFlow"

export const FLOW_NODE_WIDTH = 190
export const FLOW_NODE_HEIGHT = 72

export interface FlowLayoutNode {
  id: string
  step: EmailStudioFlowStep | null
  x: number
  y: number
}

export interface FlowLayoutEdge {
  id: string
  from: string
  to: string
  label: "Yes" | "No" | null
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
}

export interface FlowLayout {
  nodes: FlowLayoutNode[]
  edges: FlowLayoutEdge[]
  width: number
  height: number
}

function links(step: EmailStudioFlowStep): { id: string; label: "Yes" | "No" | null }[] {
  if (step.type === "split") {
    return [
      ...(step.yes ? [{ id: step.yes, label: "Yes" as const }] : []),
      ...(step.no ? [{ id: step.no, label: "No" as const }] : []),
    ]
  }
  return step.next ? [{ id: step.next, label: null }] : []
}

export function layoutEmailStudioFlow(definition: EmailStudioFlowDefinition): FlowLayout {
  const byId = new Map(definition.steps.map((step) => [step.id, step]))
  const order: string[] = []
  const ranks = new Map<string, number>()
  const visiting = new Set<string>()

  function visit(id: string | null, rank: number): void {
    if (!id || visiting.has(id) || !byId.has(id)) return
    const previousRank = ranks.get(id)
    if (previousRank === undefined) order.push(id)
    ranks.set(id, Math.max(previousRank ?? 0, rank))
    if (previousRank !== undefined) return
    visiting.add(id)
    const step = byId.get(id)
    if (step) {
      for (const link of links(step)) visit(link.id, rank + 1)
    }
    visiting.delete(id)
  }

  visit(definition.entryStepId, 1)
  for (const step of definition.steps) {
    if (!ranks.has(step.id)) {
      order.push(step.id)
      ranks.set(step.id, Math.max(1, ...ranks.values()) + 1)
    }
  }
  for (let pass = 0; pass < definition.steps.length; pass += 1) {
    let changed = false
    for (const step of definition.steps) {
      const sourceRank = ranks.get(step.id)
      if (sourceRank === undefined) continue
      for (const link of links(step)) {
        const targetRank = ranks.get(link.id)
        const candidateRank = Math.min(sourceRank + 1, definition.steps.length + 1)
        if (targetRank !== undefined && targetRank < candidateRank) {
          ranks.set(link.id, candidateRank)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  const grouped = new Map<number, string[]>()
  for (const id of order) {
    const rank = ranks.get(id) ?? 1
    grouped.set(rank, [...(grouped.get(rank) ?? []), id])
  }
  const maxColumns = Math.max(1, ...[...grouped.values()].map((items) => items.length))
  const horizontalGap = 54
  const verticalGap = 68
  const padding = 36
  const width = Math.max(
    720,
    padding * 2 + maxColumns * FLOW_NODE_WIDTH + (maxColumns - 1) * horizontalGap,
  )
  const maxRank = Math.max(1, ...ranks.values())
  const height = padding * 2 + (maxRank + 1) * FLOW_NODE_HEIGHT + maxRank * verticalGap
  const positions = new Map<string, { x: number; y: number }>()
  positions.set("trigger", {
    x: (width - FLOW_NODE_WIDTH) / 2,
    y: padding,
  })
  for (const [rank, ids] of grouped) {
    const rowWidth = ids.length * FLOW_NODE_WIDTH + Math.max(0, ids.length - 1) * horizontalGap
    const startX = (width - rowWidth) / 2
    ids.forEach((id, index) => {
      positions.set(id, {
        x: startX + index * (FLOW_NODE_WIDTH + horizontalGap),
        y: padding + rank * (FLOW_NODE_HEIGHT + verticalGap),
      })
    })
  }

  const nodes: FlowLayoutNode[] = [
    { id: "trigger", step: null, ...(positions.get("trigger") ?? { x: 0, y: 0 }) },
    ...order.flatMap((id) => {
      const step = byId.get(id)
      const position = positions.get(id)
      return step && position ? [{ id, step, ...position }] : []
    }),
  ]
  const rawEdges: { from: string; to: string; label: "Yes" | "No" | null }[] = []
  if (definition.entryStepId && positions.has(definition.entryStepId)) {
    rawEdges.push({ from: "trigger", to: definition.entryStepId, label: null })
  }
  for (const step of definition.steps) {
    for (const link of links(step)) {
      if (positions.has(step.id) && positions.has(link.id)) {
        rawEdges.push({ from: step.id, to: link.id, label: link.label })
      }
    }
  }
  const edges = rawEdges.flatMap((edge, index) => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (!from || !to) return []
    return [{
      ...edge,
      id: `${edge.from}:${edge.to}:${index}`,
      sourceX: from.x + FLOW_NODE_WIDTH / 2,
      sourceY: from.y + FLOW_NODE_HEIGHT,
      targetX: to.x + FLOW_NODE_WIDTH / 2,
      targetY: to.y,
    }]
  })
  return { nodes, edges, width, height }
}
