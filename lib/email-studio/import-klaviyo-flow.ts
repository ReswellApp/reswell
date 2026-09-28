import {
  klaviyoFromEmail,
  klaviyoFromLabel,
} from "@/lib/email-studio/flow-definition"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowFilter,
  EmailStudioFlowStep,
  EmailStudioFlowTrigger,
} from "@/lib/types/emailStudioFlow"

type Json = Record<string, unknown>

export interface KlaviyoRemoteAction {
  id: string
  actionType?: string
  definition?: Json
}

export interface ImportedKlaviyoEmail {
  actionId: string
  projectId: string
  templateId: string
  name: string
  subject: string
  previewText: string
}

export interface ImportedKlaviyoFlow {
  definition: EmailStudioFlowDefinition
  emails: ImportedKlaviyoEmail[]
  unsupportedActions: string[]
}

function record(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Json
    : null
}

function records(value: unknown): Json[] {
  return Array.isArray(value)
    ? value.filter((item): item is Json => Boolean(record(item)))
    : []
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizedActionType(action: KlaviyoRemoteAction): string {
  const raw = text(action.definition?.type) || action.actionType || ""
  return raw.toLowerCase().replaceAll("_", "-")
}

export function supportedKlaviyoActionType(type: string): boolean {
  return [
    "send-email",
    "time-delay",
    "send-sms",
    "send-webhook",
    "update-profile",
    "list-update",
    "conditional-split",
    "trigger-split",
  ].includes(type.toLowerCase().replaceAll("_", "-"))
}

function parseTrigger(
  definition: Json,
  names: {
    metrics: Map<string, string>
    lists: Map<string, string>
    segments: Map<string, string>
  },
): EmailStudioFlowTrigger {
  const trigger = records(definition.triggers)[0] ?? {}
  const type = text(trigger.type)
  const id = text(trigger.id)
  if (type === "list") {
    return { type: "list", listId: id, listName: names.lists.get(id) ?? id }
  }
  if (type === "segment") {
    return { type: "segment", segmentId: id, segmentName: names.segments.get(id) ?? id }
  }
  if (type === "date") {
    const unit = text(trigger.timedelta_unit_before_date)
    const recurrence = text(trigger.recurrence_frequency)
    return {
      type: "profile-date",
      property: text(trigger.date_profile_property) || "Birthday",
      beforeUnit: unit === "weeks" || unit === "months" ? unit : "days",
      beforeValue: Math.max(0, Math.round(number(trigger.timedelta_value_before_date, 0))),
      recurrence: recurrence === "annually" || recurrence === "monthly" || recurrence === "weekly"
        ? recurrence
        : "never",
    }
  }
  return {
    type: "metric",
    metricId: id,
    metricName: names.metrics.get(id) ?? id,
  }
}

function firstCondition(value: unknown): Json | null {
  const groups = records(record(value)?.condition_groups)
  return records(groups[0]?.conditions)[0] ?? null
}

function parseProfileFilter(definition: Json): EmailStudioFlowFilter {
  if (!definition.profile_filter) return { type: "none" }
  const condition = firstCondition(definition.profile_filter)
  if (!condition) return { type: "none" }
  if (condition.type === "profile-marketing-consent") return { type: "email-subscribed" }
  if (condition.type === "profile-property") {
    const filter = record(condition.filter)
    return {
      type: "property-equals",
      property: text(condition.property) || "source",
      value: text(filter?.value),
    }
  }
  return { type: "none" }
}

function linkId(
  value: unknown,
  ids: Map<string, string>,
): string | null {
  const remote = text(value)
  return remote ? ids.get(remote) ?? null : null
}

function operator(value: unknown): "equals" | "contains" | "not-equals" {
  return value === "contains" || value === "not-equals" ? value : "equals"
}

export function importKlaviyoFlowDefinition(input: {
  definition: Json
  actions: KlaviyoRemoteAction[]
  metricNames: Map<string, string>
  listNames: Map<string, string>
  segmentNames: Map<string, string>
  idFactory?: () => string
}): ImportedKlaviyoFlow {
  const idFactory = input.idFactory ?? (() => crypto.randomUUID())
  const ids = new Map(input.actions.map((action) => [action.id, idFactory()]))
  const emails: ImportedKlaviyoEmail[] = []
  const unsupportedActions: string[] = []
  const steps: EmailStudioFlowStep[] = []

  for (const action of input.actions) {
    const id = ids.get(action.id)
    if (!id) continue
    const type = normalizedActionType(action)
    const definition = action.definition ?? {}
    const data = record(definition.data) ?? {}
    const links = record(definition.links) ?? {}
    const next = linkId(links.next, ids)

    if (type === "time-delay") {
      const unit = text(data.unit)
      steps.push({
        id,
        type: "delay",
        unit: unit === "minutes" || unit === "days" ? unit : "hours",
        value: Math.max(1, Math.round(number(data.value, 1))),
        next,
      })
    } else if (type === "send-email") {
      const message = record(data.message) ?? {}
      const templateId = text(message.template_id)
      if (!templateId) {
        unsupportedActions.push("Email without a reusable template")
        continue
      }
      const projectId = idFactory()
      emails.push({
        actionId: action.id,
        projectId,
        templateId,
        name: text(message.name).replace(/ · RS .+$/, "") || "Flow email",
        subject: text(message.subject_line),
        previewText: text(message.preview_text),
      })
      steps.push({
        id,
        type: "email",
        projectId,
        fromEmail: text(message.from_email) || klaviyoFromEmail(),
        fromLabel: text(message.from_label) || klaviyoFromLabel(),
        smartSending: message.smart_sending_enabled !== false,
        transactional: message.transactional === true,
        status: data.status === "draft" ? "draft" : "live",
        next,
      })
    } else if (type === "send-sms") {
      const message = record(data.message) ?? {}
      steps.push({
        id,
        type: "sms",
        body: text(message.body),
        smartSending: message.smart_sending_enabled !== false,
        next,
      })
    } else if (type === "send-webhook") {
      const message = record(data.message) ?? {}
      steps.push({
        id,
        type: "webhook",
        url: text(message.url),
        body: text(message.body),
        next,
      })
    } else if (type === "update-profile") {
      const operation = records(data.profile_operations)[0] ?? {}
      steps.push({
        id,
        type: "update-profile",
        property: text(operation.property_key) || "source",
        value: text(operation.property_value),
        next,
      })
    } else if (type === "list-update") {
      steps.push({
        id,
        type: "list-update",
        listId: text(data.list_id),
        add: data.on_execution !== false,
        next,
      })
    } else if (type === "conditional-split" || type === "trigger-split") {
      const condition = type === "trigger-split"
        ? firstCondition(data.trigger_filter)
        : firstCondition(data.profile_filter)
      const filter = record(condition?.filter)
      const isConsent = condition?.type === "profile-marketing-consent"
      steps.push({
        id,
        type: "split",
        mode: type === "trigger-split"
          ? "event-property"
          : isConsent
            ? "email-subscribed"
            : "profile-property",
        property: text(condition?.field) || text(condition?.property),
        operator: operator(filter?.operator),
        value: text(filter?.value),
        yes: linkId(links.next_if_true, ids),
        no: linkId(links.next_if_false, ids),
      })
    } else {
      unsupportedActions.push(action.actionType || type || "Unknown action")
    }
  }

  const entryRemoteId = text(input.definition.entry_action_id)
  return {
    definition: {
      trigger: parseTrigger(input.definition, {
        metrics: input.metricNames,
        lists: input.listNames,
        segments: input.segmentNames,
      }),
      profileFilter: parseProfileFilter(input.definition),
      entryStepId: ids.get(entryRemoteId) ?? steps[0]?.id ?? null,
      steps,
    },
    emails,
    unsupportedActions: [...new Set(unsupportedActions)],
  }
}
