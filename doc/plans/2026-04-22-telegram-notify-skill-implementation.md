# Telegram Notify Skill Implementation Plan

**Date:** 2026-04-22  
**Status:** Ready for Implementation  
**Target Agent:** CEO Agent (or any agent requiring Telegram notifications)

## Overview

Created a new Paperclip skill (`telegram-notify`) that enables agents to send Telegram notifications and alerts through the `paperclip-plugin-telegram`. This skill provides a structured interface for agents to leverage Telegram messaging capabilities.

## What Was Created

### 1. Skill Structure

```
skills/telegram-notify/
├── SKILL.md          # Main skill documentation (agent-facing)
└── README.md         # Installation and usage guide (operator-facing)
```

### 2. Documentation Files

- **`skills/telegram-notify/SKILL.md`** - Complete skill reference for agents
  - Authentication details
  - Quick start examples
  - Common use cases
  - Message formatting
  - Troubleshooting guide

- **`skills/telegram-notify/README.md`** - Installation guide for operators
  - Step-by-step installation
  - Prerequisites checklist
  - Configuration verification
  - Example workflows

- **`doc/telegram-plugin-usage-guide.md`** - Comprehensive usage guide
  - Three methods for sending messages
  - Code examples in multiple languages
  - Configuration details
  - Troubleshooting tips

## Implementation Steps

### Step 1: Verify Plugin Installation

```bash
# Check if telegram plugin is installed
curl -s http://localhost:3100/api/plugins \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '.[] | select(.packageName == "paperclip-plugin-telegram")'

# If not installed, install it
curl -X POST http://localhost:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"paperclip-plugin-telegram"}'
```

### Step 2: Configure Plugin

1. **Get Telegram Bot Token:**
   - Chat with [@BotFather](https://t.me/BotFather)
   - Run `/newbot` and follow prompts
   - Save the bot token

2. **Get Chat ID:**
   ```bash
   # Send a message to your bot, then:
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
   # Find the "chat.id" field
   ```

3. **Store Bot Token as Secret:**
   - Go to Paperclip UI: Settings → Secrets → Create new secret
   - Paste bot token as secret value
   - Copy the resulting UUID

4. **Configure Plugin:**
   - Go to Paperclip UI: Settings → Plugins → Telegram Bot
   - Set `telegramBotTokenRef` to the UUID from step 3
   - Set `defaultChatId` to your chat ID
   - Optional: Configure `approvalsChatId`, `errorsChatId`, `escalationChatId`

### Step 3: Import Skill to Company

```bash
# From Paperclip root directory
npx paperclipai skill import \
  --company-id YOUR_COMPANY_ID \
  --path skills/telegram-notify
```

### Step 4: Assign Skill to CEO Agent

**Option A: Via API (during agent creation)**

```bash
curl -X POST http://localhost:3100/api/companies/COMPANY_ID/agents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CEO",
    "role": "ceo",
    "adapterType": "claude_local",
    "desiredSkills": ["paperclip", "telegram-notify"],
    "adapterConfig": {
      "cwd": "/path/to/workspace"
    }
  }'
```

**Option B: Via API (existing agent)**

```bash
curl -X POST http://localhost:3100/api/agents/CEO_AGENT_ID/skills/sync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "desiredSkills": ["paperclip", "telegram-notify"]
  }'
```

**Option C: Via Paperclip UI**

1. Navigate to Agents → CEO Agent
2. Click "Edit Skills"
3. Add "telegram-notify" to the skills list
4. Save changes

### Step 5: Verify Installation

```bash
# Check company skills
curl -s http://localhost:3100/api/companies/COMPANY_ID/skills \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '.[] | select(.name == "telegram-notify")'

# Check agent skills
curl -s http://localhost:3100/api/agents/AGENT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '.skills'
```

### Step 6: Test the Skill

**Test 1: Create Alert Issue (triggers automatic notification)**

```bash
curl -X POST http://localhost:3100/api/companies/COMPANY_ID/issues \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Alert: Telegram Skill",
    "description": "Testing telegram-notify skill integration",
    "status": "blocked",
    "priority": "high",
    "assigneeAgentId": "CEO_AGENT_ID"
  }'
```

**Test 2: Request Approval (sends interactive buttons)**

```bash
curl -X POST http://localhost:3100/api/companies/COMPANY_ID/approvals \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request_board_approval",
    "requestedByAgentId": "CEO_AGENT_ID",
    "issueIds": ["test-issue-id"],
    "payload": {
      "title": "Test Approval Request",
      "summary": "Testing telegram approval flow",
      "recommendedAction": "Approve for testing"
    }
  }'
```

**Test 3: Direct Message (advanced)**

```bash
# Get bot token from secrets
TELEGRAM_BOT_TOKEN=$(curl -s http://localhost:3100/api/secrets/TOKEN_UUID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq -r '.value')

# Send test message
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "YOUR_CHAT_ID",
    "text": "Test message from telegram-notify skill"
  }'
```

## Usage Examples for CEO Agent

### Example 1: Send Budget Alert

```bash
#!/bin/bash
# CEO sends critical budget alert

ISSUE_RESPONSE=$(curl -s -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🚨 Budget Alert: 95% Threshold Reached",
    "description": "Company budget at 95% - immediate review required",
    "status": "blocked",
    "priority": "critical",
    "assigneeAgentId": "cfo-agent-id"
  }')

ISSUE_ID=$(echo "$ISSUE_RESPONSE" | jq -r '.id')

# Add follow-up with @mention
curl -X POST "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "@CFO Please review budget allocation and propose cost reduction measures within 24 hours."
  }'

echo "Budget alert sent via issue: $ISSUE_ID"
```

### Example 2: Request Board Approval for Hiring

```bash
#!/bin/bash
# CEO requests approval for new hire

curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request_board_approval",
    "requestedByAgentId": "'"$PAPERCLIP_AGENT_ID"'",
    "issueIds": ["hiring-issue-id"],
    "payload": {
      "title": "Approve CTO Hire",
      "summary": "Candidate: John Doe, Salary: $180k/year, Start: 2026-05-01",
      "recommendedAction": "Approve hire and proceed with onboarding",
      "risks": [
        "High salary commitment",
        "30-day notice period required"
      ]
    }
  }'
```

### Example 3: Escalate Critical Issue

```bash
#!/bin/bash
# CEO escalates production issue

curl -X POST "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "🚨 ESCALATION: Production database performance degraded by 60%. @CTO @DevOps immediate attention required."
  }'

# Update issue to blocked
curl -X PATCH "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "blocked",
    "priority": "critical"
  }'
```

## Automatic Notification Triggers

The plugin automatically sends Telegram notifications for:

| Event | Trigger | Destination Chat |
|-------|---------|------------------|
| Issue created | New issue | `defaultChatId` |
| Issue completed | Status → done | `defaultChatId` |
| Approval requested | New approval | `approvalsChatId` or default |
| Agent error | Agent failure | `errorsChatId` or default |
| Agent escalation | `escalate_to_human` tool | `escalationChatId` or default |
| Run started | Agent heartbeat start | `defaultChatId` |
| Run finished | Agent heartbeat end | `defaultChatId` |

## Configuration Best Practices

### For CEO Agent

1. **Separate Chat Channels:**
   - `defaultChatId` - General notifications
   - `approvalsChatId` - Board approval requests (high priority)
   - `errorsChatId` - Critical system errors
   - `escalationChatId` - Agent escalations requiring human intervention

2. **Message Routing:**
   - Use issue priority to control notification urgency
   - Set `critical` priority for immediate attention items
   - Use `high` for important but not urgent
   - Use `medium`/`low` for informational updates

3. **Rate Limiting:**
   - Telegram limits: 30 messages/second per chat
   - Plugin automatically retries with backoff
   - Consider batching non-urgent notifications

## Troubleshooting

### Skill Not Available to Agent

```bash
# Check if skill is imported
curl -s http://localhost:3100/api/companies/COMPANY_ID/skills \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.[] | select(.name == "telegram-notify")'

# If not found, import it
npx paperclipai skill import \
  --company-id COMPANY_ID \
  --path skills/telegram-notify
```

### Messages Not Sending

1. **Verify plugin configuration:**
   ```bash
   curl -s http://localhost:3100/api/companies/COMPANY_ID/plugins/telegram \
     -H "Authorization: Bearer YOUR_API_KEY" | jq '.config'
   ```

2. **Test bot token directly:**
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/getMe"
   ```

3. **Check Paperclip logs:**
   ```bash
   # Look for telegram plugin errors
   tail -f data/pglite/logs/paperclip.log | grep telegram
   ```

### Agent Not Using Skill

1. **Verify skill assignment:**
   ```bash
   curl -s http://localhost:3100/api/agents/AGENT_ID \
     -H "Authorization: Bearer YOUR_API_KEY" | jq '.skills'
   ```

2. **Check agent's skill context:**
   - Skills are loaded during agent heartbeat
   - Restart agent or trigger new heartbeat
   - Check agent logs for skill loading errors

## Documentation References

- **Skill Documentation:** `skills/telegram-notify/SKILL.md`
- **Installation Guide:** `skills/telegram-notify/README.md`
- **Usage Guide:** `doc/telegram-plugin-usage-guide.md`
- **Plugin README:** `packages/plugins/plugin-telegram/README.md`
- **Paperclip Skill:** `skills/paperclip/SKILL.md`
- **API Reference:** `skills/paperclip/references/api-reference.md`

## Success Criteria

- ✅ Skill structure created (`skills/telegram-notify/`)
- ✅ SKILL.md documentation complete
- ✅ README.md installation guide complete
- ✅ Usage guide created (`doc/telegram-plugin-usage-guide.md`)
- ✅ Implementation plan documented
- ⏳ Plugin installed and configured (operator task)
- ⏳ Skill imported to company (operator task)
- ⏳ Skill assigned to CEO agent (operator task)
- ⏳ Integration tested (operator task)

## Next Steps

1. **Operator:** Follow Step 1-6 above to install and configure
2. **CEO Agent:** Use skill in heartbeats to send notifications
3. **Monitor:** Check Telegram for notifications
4. **Iterate:** Adjust chat routing and priorities as needed

## Notes

- The skill leverages the existing `paperclip-plugin-telegram` package
- No code changes required to Paperclip core
- Skill is reusable across any agent that needs Telegram notifications
- Plugin handles all Telegram API interactions
- Automatic notifications work without explicit skill usage
- Skill provides structured interface for manual/custom notifications
