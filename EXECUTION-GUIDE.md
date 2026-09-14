# EXECUTION INSTRUCTIONS

## 🚨 URGENT - Execute Immediately After PR Merge

This guide is for the team member who will execute the ban script after this PR is merged.

## Prerequisites

1. ✅ PR #435 has been merged to main
2. ✅ Pull latest main branch: `git pull origin main`
3. ✅ Install dependencies: `npm install`
4. ✅ Environment variables are set (see below)

## Environment Setup

Create `.env.local` with:
```bash
NEXT_PUBLIC_SUPABASE_URL=<your-production-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**⚠️ IMPORTANT:** These are production secrets. Never commit them to git.

## Step 1: Dry Run (MANDATORY FIRST STEP)

```bash
npx tsx scripts/ban-fake-support-accounts.ts
```

This will output:
- How many fake accounts were found
- Account details (ID, display name, email, created date)
- How many messages will be deleted

**Review this output carefully!** Verify these are actually fraudulent accounts.

Example output:
```
🔍 Searching for fake support accounts...

⚠️  Found 12 fake support account(s):

  ID: abc123...
  Display Name: RESWELL SUPPORT
  Email: scammer1@example.com
  Created: 2026-09-13T10:23:45Z

  [... more accounts ...]

📨 Found 47 message(s) from fake accounts

DRY RUN - Preview:
==================
Accounts to ban: 12
Messages to delete: 47

Re-run with --execute to permanently ban these accounts and delete their messages.
```

## Step 2: Execute (Only After Verifying Dry Run)

```bash
npx tsx scripts/ban-fake-support-accounts.ts --execute
```

This will:
1. Delete all messages from fake accounts
2. Ban all fake accounts permanently
3. Print a summary of actions taken

Example output:
```
🚨 EXECUTING - Banning accounts and deleting messages...

📨 Deleting messages...
✓ Deleted message msg_001
✓ Deleted message msg_002
[...]

✅ Deleted 47 message(s)

🔒 Banning accounts...

✅ Banned 12 account(s)

✅ COMPLETE
===================
Total accounts banned: 12
Total messages deleted: 47
```

## Step 3: Verify

After execution, verify:

1. **Check banned accounts cannot log in:**
   - Try logging in with one of the banned email addresses
   - Should see "Your account has been suspended" or similar

2. **Check messages are deleted:**
   - Look at affected conversation threads
   - Fake support messages should be gone

3. **Check new accounts are blocked:**
   - Try creating a new account with display name "RESWELL SUPPORT"
   - Should show error: "This display name is not allowed"

## Step 4: Deploy to Production

Once the PR is merged:
```bash
git checkout main
git pull origin main
# Deploy via your normal CI/CD process (Vercel, etc.)
```

The database migration will auto-apply on deployment, preventing future attacks.

## Troubleshooting

### Error: "Missing NEXT_PUBLIC_SUPABASE_URL"
- Make sure `.env.local` exists with the correct values
- Check that variable names match exactly

### Error: "User not found"
- This is expected if an account was already deleted
- The script will continue with remaining accounts

### Error: "Admin accounts cannot be banned"
- This is a safety check - never ban admin accounts
- Review the account to verify it's not legitimate

### No accounts found
- Great! Either there were no fake accounts, or they've already been removed
- You can still run the migration to prevent future attacks

## Safety Features

The script includes multiple safety checks:
- ✅ Never bans admin accounts
- ✅ Dry-run mode by default
- ✅ Detailed logging of all actions
- ✅ Explicit `--execute` flag required for permanent changes
- ✅ Database-level prevention after deployment

## Need Help?

If you encounter issues:
1. Check the full error message
2. Verify environment variables are correct
3. Check that you have service role permissions in Supabase
4. Contact the team in Slack/Discord

## After Execution

- [ ] Document how many accounts were banned
- [ ] Save the dry-run output for records
- [ ] Monitor for any new attempts (check admin panel)
- [ ] Consider adding alerts for new "RESWELL" usernames

---

**Remember:** Always run dry-run first, verify the output, then execute.
