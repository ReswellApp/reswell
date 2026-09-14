# Ban Fake Support Accounts Script

## ⚠️ URGENT SECURITY ISSUE

This script addresses fraudulent accounts impersonating "RESWELL SUPPORT" to scam users.

## What It Does

1. **Identifies** all non-admin accounts with display names containing variations of "RESWELL SUPPORT"
2. **Deletes** all messages sent by these fraudulent accounts
3. **Permanently bans** these accounts from the platform

## Usage

### Dry Run (Preview Only - RECOMMENDED FIRST)
```bash
npx tsx scripts/ban-fake-support-accounts.ts
```

This will show you:
- How many accounts will be banned
- How many messages will be deleted
- Details of each account (ID, display name, email)

### Execute (Permanent Action)
```bash
npx tsx scripts/ban-fake-support-accounts.ts --execute
```

⚠️ **WARNING**: This permanently:
- Bans all identified accounts
- Deletes all their messages
- Cannot be undone

## Requirements

You need the following environment variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Prevention

The database migration `20270918120000_block_fake_support_usernames.sql` adds a trigger that:
- Blocks new accounts from using "RESWELL SUPPORT" and similar names
- Only allows admin accounts to use official support names
- Prevents future impersonation attempts

## Database Migration

After running the script, apply the migration to prevent future attacks:

```bash
# Apply migration to Supabase
supabase db push

# Or in production, the migration will auto-apply on next deploy
```

## What Names Are Blocked?

The migration blocks display names containing:
- "reswell support"
- "reswell admin"
- "reswell team"
- "reswell staff"
- "reswell official"
- "reswell help"
- "reswell" (standalone)
- And variations with spacing

Admin accounts are exempt from these restrictions.
