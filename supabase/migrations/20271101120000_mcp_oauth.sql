-- MCP OAuth 2.1 authorization server tables for Reswell agent shopping.
-- Access tokens bind to a user, scopes, and MCP resource audience.
-- Service role performs token lifecycle; users revoke via server actions.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mcp_oauth_clients (
  client_id text PRIMARY KEY,
  client_secret_hash text,
  client_name text NOT NULL DEFAULT 'MCP client',
  redirect_uris text[] NOT NULL,
  grant_types text[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token']::text[],
  response_types text[] NOT NULL DEFAULT ARRAY['code']::text[],
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_clients_redirect_uris_nonempty CHECK (cardinality(redirect_uris) >= 1),
  CONSTRAINT mcp_oauth_clients_auth_method_check CHECK (
    token_endpoint_auth_method IN ('none', 'client_secret_post', 'client_secret_basic')
  )
);

COMMENT ON TABLE public.mcp_oauth_clients IS
  'Dynamically registered OAuth clients (Grok, Claude, ChatGPT, Cursor) for Reswell MCP.';

CREATE TABLE IF NOT EXISTS public.mcp_oauth_authorization_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.mcp_oauth_clients (client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256',
  resource text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_oauth_authorization_codes_challenge_method_check CHECK (
    code_challenge_method = 'S256'
  ),
  CONSTRAINT mcp_oauth_authorization_codes_scopes_nonempty CHECK (cardinality(scopes) >= 1)
);

CREATE INDEX IF NOT EXISTS mcp_oauth_authorization_codes_expires_idx
  ON public.mcp_oauth_authorization_codes (expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mcp_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token_hash text NOT NULL UNIQUE,
  refresh_token_hash text UNIQUE,
  client_id text NOT NULL REFERENCES public.mcp_oauth_clients (client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  scopes text[] NOT NULL,
  resource text NOT NULL,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  CONSTRAINT mcp_oauth_tokens_scopes_nonempty CHECK (cardinality(scopes) >= 1)
);

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_user_live_idx
  ON public.mcp_oauth_tokens (user_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS mcp_oauth_tokens_access_lookup_idx
  ON public.mcp_oauth_tokens (access_token_hash)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE public.mcp_oauth_tokens IS
  'Opaque access/refresh tokens for Reswell MCP. Buyer id and scopes come from the token, never from tool args.';

ALTER TABLE public.mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No direct client policies: Next.js uses the service role after session checks.

COMMIT;
