import { walkFlowSteps } from "./flow-definition"
import type {
  EmailStudioFlowDefinition,
  EmailStudioFlowFilter,
  EmailStudioFlowStep,
  EmailStudioFlowTrigger,
  FlowSplitStep,
} from "@/lib/types/emailStudioFlow"

export interface CompiledFlowEmail {
  stepId: string
  projectId: string
  fromEmail: string
  fromLabel: string
  smartSending: boolean
  transactional: boolean
}

type Json = Record<string, unknown>

function stringFilter(operator: string, value: string): Json {
  return { type: "string", operator, value }
}

function profilePropertyEquals(property: string, value: string): Json {
  return {
    type: "profile-property",
    property,
    filter: stringFilter("equals", value),
  }
}

function emailSubscribedCondition(): Json {
  return {
    type: "profile-marketing-consent",
    consent: {
      channel: "email",
      can_receive_marketing: true,
      consent_status: { subscription: "subscribed" },
    },
  }
}

function conditionFilter(condition: Json | null): Json | null {
  if (!condition) return null
  return { condition_groups: [{ conditions: [condition] }] }
}

function profileFilter(filter: EmailStudioFlowFilter): Json | null {
  if (filter.type === "none") return null
  if (filter.type === "email-subscribed") return conditionFilter(emailSubscribedCondition())
  return conditionFilter(profilePropertyEquals(filter.property, filter.value))
}

function triggerPayload(trigger: EmailStudioFlowTrigger): Json {
  switch (trigger.type) {
    case "metric":
      if (!trigger.metricId) throw new Error("Pick the metric that starts this flow.")
      return { type: "metric", id: trigger.metricId, trigger_filter: null }
    case "list":
      if (!trigger.listId) throw new Error("Pick the list that starts this flow.")
      return { type: "list", id: trigger.listId }
    case "segment":
      if (!trigger.segmentId) throw new Error("Pick the segment that starts this flow.")
      return { type: "segment", id: trigger.segmentId }
    case "profile-date":
      return {
        type: "date",
        date_field_type: "profile-property",
        date_profile_property: trigger.property,
        timedelta_unit_before_date: trigger.beforeUnit,
        timedelta_value_before_date: trigger.beforeValue,
        recurrence_frequency: trigger.recurrence,
        timezone: "profile",
      }
  }
}

function splitData(step: FlowSplitStep, metricId: string): Json {
  if (step.mode === "email-subscribed") {
    return { profile_filter: conditionFilter(emailSubscribedCondition()) }
  }
  if (step.mode === "profile-property") {
    if (!step.property.trim()) throw new Error("Name the profile property on the split.")
    return {
      profile_filter: conditionFilter(profilePropertyEquals(step.property, step.value)),
    }
  }
  if (!metricId) throw new Error("An event split needs a metric trigger.")
  if (!step.property.trim()) throw new Error("Name the event property on the split.")
  return {
    trigger_type: "metric",
    trigger_id: metricId,
    trigger_filter: conditionFilter({
      type: "metric-property",
      metric_id: metricId,
      field: step.property,
      filter: stringFilter(step.operator, step.value),
    }),
  }
}

function actionPayload(
  step: EmailStudioFlowStep,
  templateIds: Map<string, string>,
  subjects: Map<string, { subject: string; preview: string; name: string }>,
  metricId: string,
): Json {
  const temporary_id = step.id
  if (step.type === "delay") {
    return {
      temporary_id,
      type: "time-delay",
      links: { next: step.next },
      data: {
        unit: step.unit,
        value: step.value,
        secondary_value: 0,
        timezone: "profile",
      },
    }
  }
  if (step.type === "email") {
    const templateId = templateIds.get(step.projectId)
    if (!templateId) throw new Error("Push each email to Klaviyo before the flow.")
    const copy = subjects.get(step.projectId)
    return {
      temporary_id,
      type: "send-email",
      links: { next: step.next },
      data: {
        status: "live",
        message: {
          from_email: step.fromEmail,
          from_label: step.fromLabel,
          reply_to_email: null,
          cc_email: null,
          bcc_email: null,
          subject_line: copy?.subject || "Reswell",
          preview_text: copy?.preview || "",
          template_id: templateId,
          smart_sending_enabled: step.smartSending,
          transactional: step.transactional,
          add_tracking_params: false,
          custom_tracking_params: null,
          additional_filters: null,
          name: (copy?.name || "Email").slice(0, 255),
        },
      },
    }
  }
  if (step.type === "sms") {
    if (!step.body.trim()) throw new Error("Write the SMS before pushing.")
    return {
      temporary_id,
      type: "send-sms",
      links: { next: step.next },
      data: {
        status: "live",
        message: {
          body: step.body,
          smart_sending_enabled: step.smartSending,
          transactional: false,
          shorten_links: true,
          add_org_prefix: true,
          add_opt_out_language: true,
          sms_quiet_hours_enabled: true,
          add_tracking_params: false,
          custom_tracking_params: null,
          additional_filters: null,
          name: "SMS",
        },
      },
    }
  }
  if (step.type === "webhook") {
    if (!step.url.startsWith("https://")) throw new Error("Webhook URLs need to start with https://")
    return {
      temporary_id,
      type: "send-webhook",
      links: { next: step.next },
      data: {
        status: "live",
        message: { url: step.url, headers: {}, body: step.body, name: "Webhook" },
      },
    }
  }
  if (step.type === "update-profile") {
    return {
      temporary_id,
      type: "update-profile",
      links: { next: step.next },
      data: {
        status: "live",
        profile_operations: [
          {
            operator: "update",
            property_type: "string",
            property_key: step.property,
            property_value: step.value,
          },
        ],
      },
    }
  }
  if (step.type === "list-update") {
    return {
      temporary_id,
      type: "list-update",
      links: { next: step.next },
      data: {
        status: "live",
        name: step.add ? "Add to list" : "Remove from list",
        on_execution: step.add,
        list_id: step.listId,
      },
    }
  }
  const split = splitData(step, metricId)
  if (step.mode === "event-property") {
    return {
      temporary_id,
      type: "trigger-split",
      links: { next_if_true: step.yes, next_if_false: step.no },
      data: split,
    }
  }
  return {
    temporary_id,
    type: "conditional-split",
    links: { next_if_true: step.yes, next_if_false: step.no },
    data: split,
  }
}

export function compileKlaviyoFlow(input: {
  name: string
  definition: EmailStudioFlowDefinition
  templateIds: Map<string, string>
  subjects: Map<string, { subject: string; preview: string; name: string }>
}): { definition: Json; emails: CompiledFlowEmail[] } {
  const steps = walkFlowSteps(input.definition)
  if (steps.length === 0) throw new Error("Add at least one action.")
  const metricId = input.definition.trigger.type === "metric" ? input.definition.trigger.metricId : ""
  const emails: CompiledFlowEmail[] = []
  for (const step of steps) {
    if (step.type !== "email") continue
    emails.push({
      stepId: step.id,
      projectId: step.projectId,
      fromEmail: step.fromEmail,
      fromLabel: step.fromLabel,
      smartSending: step.smartSending,
      transactional: step.transactional,
    })
  }
  return {
    emails,
    definition: {
      triggers: [triggerPayload(input.definition.trigger)],
      profile_filter: profileFilter(input.definition.profileFilter),
      actions: steps.map((step) => actionPayload(step, input.templateIds, input.subjects, metricId)),
      entry_action_id: input.definition.entryStepId,
    },
  }
}
