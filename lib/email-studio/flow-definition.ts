import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowStep,
} from "@/lib/types/emailStudioFlow"

export const DEFAULT_KLAVIYO_FROM_EMAIL = "hayden@reswell.app"
export const DEFAULT_KLAVIYO_FROM_LABEL = "Reswell"

export function klaviyoFromEmail(): string {
  return process.env.KLAVIYO_FROM_EMAIL?.trim() || DEFAULT_KLAVIYO_FROM_EMAIL
}

export function klaviyoFromLabel(): string {
  return process.env.KLAVIYO_FROM_LABEL?.trim() || DEFAULT_KLAVIYO_FROM_LABEL
}

export function blankFlowDefinition(): EmailStudioFlowDefinition {
  return {
    trigger: { type: "metric", metricId: "", metricName: "" },
    profileFilter: { type: "email-subscribed" },
    entryStepId: null,
    steps: [],
  }
}

export function flowStepById(
  definition: EmailStudioFlowDefinition,
  id: string | null,
): EmailStudioFlowStep | null {
  if (!id) return null
  return definition.steps.find((step) => step.id === id) ?? null
}

/** Walk every reachable step once. Throws on a cycle. Branches may rejoin. */
export function walkFlowSteps(definition: EmailStudioFlowDefinition): EmailStudioFlowStep[] {
  const ordered: EmailStudioFlowStep[] = []
  const seen = new Set<string>()
  const path = new Set<string>()

  function visit(id: string | null): void {
    if (!id || seen.has(id)) return
    if (path.has(id)) throw new Error("This flow loops back on itself.")
    const step = flowStepById(definition, id)
    if (!step) throw new Error("A flow step points at a missing action.")
    path.add(id)
    ordered.push(step)
    if (step.type === "split") {
      visit(step.yes)
      visit(step.no)
    } else {
      visit(step.next)
    }
    path.delete(id)
    seen.add(id)
  }

  visit(definition.entryStepId)
  return ordered
}

export function flowStepLabel(step: EmailStudioFlowStep): string {
  switch (step.type) {
    case "delay":
      return `Wait ${step.value} ${step.unit}`
    case "email":
      return "Email"
    case "sms":
      return "SMS"
    case "webhook":
      return "Webhook"
    case "update-profile":
      return "Update profile"
    case "list-update":
      return step.add ? "Add to list" : "Remove from list"
    case "split":
      return "Split"
  }
}
