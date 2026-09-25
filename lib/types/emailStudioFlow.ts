export const FLOW_DELAY_UNITS = ["minutes", "hours", "days"] as const
export type FlowDelayUnit = (typeof FLOW_DELAY_UNITS)[number]

export const FLOW_STRING_OPERATORS = ["equals", "contains", "not-equals"] as const
export type FlowStringOperator = (typeof FLOW_STRING_OPERATORS)[number]

export const FLOW_DATE_UNITS = ["days", "weeks", "months"] as const
export type FlowDateUnit = (typeof FLOW_DATE_UNITS)[number]

export const FLOW_RECURRENCE = ["never", "annually", "monthly", "weekly"] as const
export type FlowRecurrence = (typeof FLOW_RECURRENCE)[number]

export type EmailStudioFlowTrigger =
  | { type: "metric"; metricId: string; metricName: string }
  | { type: "list"; listId: string; listName: string }
  | { type: "segment"; segmentId: string; segmentName: string }
  | {
      type: "profile-date"
      property: string
      beforeUnit: FlowDateUnit
      beforeValue: number
      recurrence: FlowRecurrence
    }

export type EmailStudioFlowFilter =
  | { type: "none" }
  | { type: "email-subscribed" }
  | { type: "property-equals"; property: string; value: string }

interface FlowStepBase {
  id: string
}

export interface FlowDelayStep extends FlowStepBase {
  type: "delay"
  unit: FlowDelayUnit
  value: number
  next: string | null
}

export interface FlowEmailStep extends FlowStepBase {
  type: "email"
  projectId: string
  fromEmail: string
  fromLabel: string
  smartSending: boolean
  transactional: boolean
  next: string | null
}

export interface FlowSmsStep extends FlowStepBase {
  type: "sms"
  body: string
  smartSending: boolean
  next: string | null
}

export interface FlowWebhookStep extends FlowStepBase {
  type: "webhook"
  url: string
  body: string
  next: string | null
}

export interface FlowUpdateProfileStep extends FlowStepBase {
  type: "update-profile"
  property: string
  value: string
  next: string | null
}

export interface FlowListUpdateStep extends FlowStepBase {
  type: "list-update"
  listId: string
  /** True adds the profile to the list. False removes it. */
  add: boolean
  next: string | null
}

export interface FlowSplitStep extends FlowStepBase {
  type: "split"
  mode: "profile-property" | "email-subscribed" | "event-property"
  property: string
  operator: FlowStringOperator
  value: string
  yes: string | null
  no: string | null
}

export type EmailStudioFlowStep =
  | FlowDelayStep
  | FlowEmailStep
  | FlowSmsStep
  | FlowWebhookStep
  | FlowUpdateProfileStep
  | FlowListUpdateStep
  | FlowSplitStep

export interface EmailStudioFlowDefinition {
  trigger: EmailStudioFlowTrigger
  profileFilter: EmailStudioFlowFilter
  entryStepId: string | null
  steps: EmailStudioFlowStep[]
}

export interface EmailStudioFlowRecord {
  id: string
  name: string
  notes: string
  definition: EmailStudioFlowDefinition
  klaviyoFlowId: string | null
  klaviyoStatus: string
  createdAt: string
  updatedAt: string
}

export interface EmailStudioMessage {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export interface KlaviyoCatalogOption {
  id: string
  name: string
}
