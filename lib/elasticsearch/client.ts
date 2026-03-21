import { Client } from "@elastic/elasticsearch"
import { isElasticsearchConfigured } from "./config"

let client: Client | null = null

export function getElasticsearchClient(): Client | null {
  if (!isElasticsearchConfigured()) return null
  if (client) return client

  const node = process.env.ELASTICSEARCH_URL!.trim()
  const apiKey = process.env.ELASTICSEARCH_API_KEY?.trim()
  const username = process.env.ELASTICSEARCH_USERNAME?.trim()
  const password = process.env.ELASTICSEARCH_PASSWORD?.trim()

  const auth =
    apiKey
      ? { apiKey }
      : username && password
        ? { username, password }
        : undefined

  client = new Client({
    node,
    ...(auth ? { auth } : {}),
    requestTimeout: 30_000,
  })

  return client
}
