export interface FlowReplacementPlan {
  protectedFlowId: string | null
  protectedFlowStatus: string | null
  intermediateFlowIdToDisable: string | null
}

export function planFlowReplacement(input: {
  currentFlowId: string | null
  currentStatus: string
  protectedFlowId: string | null
  protectedFlowStatus: string | null
}): FlowReplacementPlan {
  const hasActivePredecessor = Boolean(
    input.protectedFlowId
    && (
      input.protectedFlowStatus === "live"
      || input.protectedFlowStatus === "manual"
    ),
  )
  const currentFlowIsActive = input.currentStatus === "live"
    || (input.currentStatus === "manual" && !hasActivePredecessor)
  return {
    protectedFlowId: currentFlowIsActive
      ? input.currentFlowId
      : input.protectedFlowId ?? input.currentFlowId,
    protectedFlowStatus: currentFlowIsActive
      ? input.currentStatus
      : input.protectedFlowStatus ?? input.currentStatus,
    intermediateFlowIdToDisable:
      input.currentStatus === "manual" && hasActivePredecessor
        ? input.currentFlowId
        : null,
  }
}
