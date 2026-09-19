/**
 * Jev routes which chat model writes the live-chat reply.
 * It never generates customer-facing text.
 */

import { experimental_evaluate } from "ai"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "./app-models.ts"
import {
  LIVE_CHAT_JEV_GATEWAY_MODEL,
  LIVE_CHAT_JEV_WRITER_CRITERIA,
  LIVE_CHAT_JEV_WRITER_INSTRUCTIONS,
  LIVE_CHAT_WRITER_FALLBACK,
  liveChatWriterModelId,
  parseLiveChatWriterId,
  type LiveChatWriterId,
} from "../live-chat/writer-route.ts"

const FEATURE = APP_LLM_FEATURES.find((row) => row.id === "live_chat_jev_router")
const CS_FEATURE = APP_LLM_FEATURES.find((row) => row.id === "live_chat_cs")

const JEV_ROUTE_TIMEOUT_MS = 2_500

export type LiveChatWriterRoute = {
  writer: LiveChatWriterId
  model: string
  source: "jev" | "fallback"
  reason: string
}

export type LiveChatJevEvaluate = typeof experimental_evaluate

export function liveChatJevRouterEnabled(): boolean {
  if (!FEATURE) return false
  return isAppLlmFeatureEnabled(FEATURE)
}

export function liveChatJevModelId(): string {
  if (!FEATURE) return LIVE_CHAT_JEV_GATEWAY_MODEL
  return resolveConfiguredModel(FEATURE)
}

export function fallbackLiveChatWriterRoute(reason: string): LiveChatWriterRoute {
  const writer = LIVE_CHAT_WRITER_FALLBACK
  return {
    writer,
    model: CS_FEATURE ? resolveConfiguredModel(CS_FEATURE) : liveChatWriterModelId(writer),
    source: "fallback",
    reason,
  }
}

export async function routeLiveChatWriterWithJev(
  args: {
    visitorMessage: string
    signedIn: boolean
  },
  deps?: {
    evaluate?: LiveChatJevEvaluate
  },
): Promise<LiveChatWriterRoute> {
  if (!liveChatJevRouterEnabled()) {
    return fallbackLiveChatWriterRoute(
      "Jev router off — no Gateway auth or LIVE_CHAT_JEV_ROUTER_ENABLED=false. Writer is the existing live-chat CS default (pro).",
    )
  }

  const evaluate = deps?.evaluate ?? experimental_evaluate
  const state = {
    product: "Reswell used-surfboard marketplace live chat",
    signed_in: args.signedIn,
    visitor_message: args.visitorMessage.trim().slice(0, 2000),
  }

  try {
    const result = await evaluate({
      model: liveChatJevModelId(),
      state,
      questions: {
        writer: {
          type: "choice",
          instructions: LIVE_CHAT_JEV_WRITER_INSTRUCTIONS,
          criteria: { ...LIVE_CHAT_JEV_WRITER_CRITERIA },
        },
      },
      abortSignal: AbortSignal.timeout(JEV_ROUTE_TIMEOUT_MS),
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("live_chat_jev_router"),
        },
      },
    })

    const choice = parseLiveChatWriterId(result.answers.writer.choice)
    if (!choice) {
      return fallbackLiveChatWriterRoute(
        `Jev returned an unknown writer choice (${String(result.answers.writer.choice)}). Using pro.`,
      )
    }

    return {
      writer: choice,
      model: liveChatWriterModelId(choice),
      source: "jev",
      reason: `Jev chose ${choice}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.warn("[liveChatJevRouter] evaluate failed, using pro writer:", message)
    return fallbackLiveChatWriterRoute(`Jev evaluate failed (${message}). Using pro.`)
  }
}
