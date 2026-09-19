import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LIVE_CHAT_BROADCAST_EVENT,
  liveChatBroadcastHttpRequest,
  liveChatSessionChannel,
} from "./realtime-channels.ts"

describe("liveChatBroadcastHttpRequest", () => {
  it("posts a public live_chat event to the Realtime REST endpoint", () => {
    const payload = {
      type: "message" as const,
      message: {
        id: "m1",
        session_id: "s1",
        sender_type: "agent" as const,
        sender_agent_id: null,
        content: "On it",
        created_at: "2026-09-19T12:00:00.000Z",
        agent_display_name: "Hayden",
      },
    }

    const request = liveChatBroadcastHttpRequest({
      supabaseUrl: "https://example.supabase.co/",
      sessionId: "s1",
      payload,
    })

    assert.equal(request.url, "https://example.supabase.co/realtime/v1/api/broadcast")
    assert.deepEqual(request.body, {
      messages: [
        {
          topic: liveChatSessionChannel("s1"),
          event: LIVE_CHAT_BROADCAST_EVENT,
          payload,
          private: false,
        },
      ],
    })
  })
})
