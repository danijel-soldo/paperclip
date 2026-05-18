# Quick Start: List Unread Issues via Telegram Bot

**Date**: 2026-04-21  
**Method**: Enhanced HTTP Request Workflow  
**Status**: ✅ Ready to Use

## Implementation Complete

Option 1 has been implemented! The enhanced HTTP request step now supports:
- ✅ Auto-injection of `{{paperclipBaseUrl}}` and `{{companyId}}`
- ✅ Automatic formatting of issue arrays
- ✅ Proper JSON response handling
- ✅ No agent invocation needed (instant response)

## Setup Instructions

### Step 1: Clean Up Old Command (If You Imported It)

If you previously imported the non-working workflow:
```
/commands delete unread
```

### Step 2: Import the New Workflow

Copy this **single-line** JSON and send it to your Telegram bot:

```
/commands import {"name":"unread","description":"List all unread issues for the current user","steps":[{"id":"fetch_unread","type":"http_request","url":"{{paperclipBaseUrl}}/api/companies/{{companyId}}/issues?unreadForUserId=me&limit=50","method":"GET"},{"id":"send_result","type":"send_message","text":"📬 Unread Issues\n\n{{fetch_unread.result}}"}]}
```

You should see:
```
✅ Command /unread imported (2 steps)
```

### Step 3: Verify Import

Check that the command is registered:
```
/commands list
```

You should see:
```
🛠️ Custom Commands

/unread - List all unread issues for the current user
  Steps: 2 | Created: 2026-04-21
```

### Step 4: Use the Command

Now you can run:
```
/unread
```

The bot will:
1. Fetch unread issues from Paperclip API
2. Format them with emojis and status
3. Send you the formatted list instantly

## Example Output

When you run `/unread`, you'll see something like:

```
📬 Unread Issues

📋 CLIP-123 - Fix login bug (todo)
🔄 CLIP-124 - Update documentation (in_progress)
👀 CLIP-125 - Review PR #456 (review)
```

Or if no unread issues:
```
📬 Unread Issues

No issues found
```

## How It Works

The workflow uses two steps:

1. **HTTP Request Step**: Calls Paperclip API with `unreadForUserId=me` filter
   - Template variables `{{paperclipBaseUrl}}` and `{{companyId}}` are auto-injected
   - Response is automatically formatted if it's an issue array
   - Emojis added based on status (✅ done, 📋 todo, 🔄 in_progress, etc.)

2. **Send Message Step**: Displays the formatted results in Telegram

## Status Emojis

- ✅ `done` - Completed
- 📋 `todo` - To Do
- 🔄 `in_progress` - In Progress
- 👀 `review` - In Review
- 🚫 `blocked` - Blocked
- 📥 `backlog` - Backlog

## Troubleshooting

### "Command /unread not found"
- Make sure you imported the workflow first
- Check `/commands list` to verify it's registered

### "No issues found" but you have unread issues
- Verify your chat is linked to a company: `/connect <company-id>`
- Check that you have board user authentication (not agent API key)
- The `unreadForUserId=me` filter requires board user context

### Import failed
- Ensure the JSON is on a single line
- Check for any copy-paste errors
- Try copying from the JSON file: `/home/vpcuser/paperclip/doc/plans/2026-04-21-telegram-unread-workflow-final.json`

### Response is raw JSON instead of formatted
- This shouldn't happen with the new implementation
- If it does, check the Paperclip server logs for errors
- Verify the plugin was rebuilt after the code changes

## Technical Details

### What Changed

The following files were modified to implement this feature:

1. **`command-registry.ts`**:
   - Enhanced `interpolate()` function to support `{{paperclipBaseUrl}}` and `{{companyId}}`
   - Enhanced `http_request` step to format issue arrays automatically
   - Added JSON parsing and response type detection
   - Added status emoji mapping

2. **`worker.ts`**:
   - Updated to pass `baseUrl` parameter through the call chain

### Template Variables

The workflow now supports these auto-injected variables:
- `{{paperclipBaseUrl}}` - Internal Paperclip API URL (e.g., `http://localhost:3100`)
- `{{companyId}}` - Current company ID from chat context
- `{{arg0}}`, `{{arg1}}`, etc. - Command arguments
- `{{args}}` - All arguments joined
- `{{prev.result}}` - Result from previous step
- `{{step_id.result}}` - Result from specific step by ID

## Other Useful Commands

While you're here, remember these built-in commands:

```
/issues          # List recent open issues (all, not just unread)
/status          # Company health overview
/agents          # Agent status
/acp spawn <id>  # Interactive agent session
/help            # Show all commands
```

## Next Steps

Now that `/unread` works, you can:

1. **Create similar workflows** for other queries:
   - Issues by project: `?projectId={{arg0}}`
   - Issues by status: `?status={{arg0}}`
   - Issues by assignee: `?assigneeAgentId={{arg0}}`

2. **Set up proactive notifications** using the watch system:
   - Register watches for new unread issues
   - Get notified when issues become unread

3. **Combine with other steps**:
   - Fetch unread issues
   - Create a summary issue
   - Send to a specific chat

## Credits

Implementation based on the Paperclip plugin SDK and the custom workflow command system (Phase 4 of the Telegram plugin).

## Support

If you encounter issues:
1. Check Paperclip server logs: `pnpm dev` output
2. Check plugin status in Paperclip UI: Settings → Plugins
3. Verify plugin is active and worker is running
4. Review the main plan document: `/home/vpcuser/paperclip/doc/plans/2026-04-21-telegram-unread-issues-workflow.md`
