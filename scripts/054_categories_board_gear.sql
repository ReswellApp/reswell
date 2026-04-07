-- OBSOLETE: `categories.gear` and used-gear marketplace paths were removed in
-- supabase/migrations/20260407180000_surfboards_only_remove_used_gear.sql.
-- Fresh installs use scripts/001_create_schema.sql (surfboard categories only).
-- This file is a no-op so old runbooks do not reintroduce `gear` or XOR constraints.
SELECT 1;
