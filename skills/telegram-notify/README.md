# Telegram Notify Skill

Send Telegram notifications and alerts through the paperclip-plugin-telegram.

## Installation

### For CEO Agent (or any agent)

1. **Ensure the Telegram plugin is installed:**

```bash
curl -X POST http://localhost:3100/api/plugins/install \
  -H "Content-Type: application/json" \
  -d '{"packageName":"paperclip-plugin-telegram"}'
```

2. **Install this skill for your company:**

```bash
# From the Paperclip root directory
npx paperclipai skill import \
  --company-id YOUR_COMPANY_ID \
  --path skills/telegram-notify
```

3. **Assign the skill to the CEO agent:**

```bash
curl -X POST http://localhost:3100/api/agents/CEO_AGENT_ID/skills/sync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "desiredSkills": ["paperclip", "telegram-notify"]
  }'
```

Or via the Paperclip API during agent creation:

```bash
curl -X POST http://localhost:3100/api/companies/COMPANY_ID/agents \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CEO",
    "role": "ceo",
    "adapterType": "claude_local",
    "desiredSkills": ["paperclip", "telegram-notify"],
    ...
  }'
```

## Prerequisites

The `paperclip-plugin-telegram` must be configured with:

1. **Bot Token** (from @BotFather):
   - Create secret: Settings → Secrets → Create new secret
   - Paste bot token as secret value
   - Copy the UUID
   - Configure plugin with `telegramBotTokenRef: <UUID>`

2. **Chat ID**:
   - Send a message to your bot
   - Run: `curl "https://api.telegram.org/bot<TOKEN>/getUpdates"`
   - Find the `chat.id` field
   - Configure plugin with `defaultChatId: <CHAT_ID>`

3. **Optional routing** (recommended for CEO):
   - `approvalsChatId` - Separate chat for approval requests
   - `errorsChatId` - Separate chat for critical errors
   - `escalationChatId` - Separate chat for agent escalations

## Usage

Once installed, the CEO agent can:

### 1. Send alerts via issue creation

```bash
# In agent context, create a critical issue
curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🚨 Budget Alert",
    "description": "Company budget at 95%",
    "status": "blocked",
    "priority": "critical"
  }'
```

### 2. Request board approval

```bash
curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request_board_approval",
    "requestedByAgentId": "'"$PAPERCLIP_AGENT_ID"'",
    "issueIds": ["issue-id"],
    "payload": {
      "title": "Approve vendor contract",
      "summary": "Annual cost: $50k",
      "recommendedAction": "Approve and proceed"
    }
  }'
```

### 3. Send direct messages (advanced)

```bash
# Get bot token from secrets
TELEGRAM_BOT_TOKEN=$(curl -s "$PAPERCLIP_API_URL/api/secrets/$TOKEN_REF" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" | jq -r '.value')

# Send message
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"$TELEGRAM_CHAT_ID"'",
    "text": "Custom alert message"
  }'
```

## Automatic Notifications

The plugin automatically sends Telegram notifications for:

- **Issue created** → Notification with issue details
- **Issue completed** → Completion confirmation
- **Approval requested** → Interactive approve/reject buttons
- **Agent error** → Error notification
- **Agent escalation** → Escalation with suggested replies
- **Run started/finished** → Lifecycle notifications

## Verification

Check if the skill is installed:

```bash
# List company skills
curl -s http://localhost:3100/api/companies/COMPANY_ID/skills \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.[] | select(.name == "telegram-notify")'

# Check agent skills
curl -s http://localhost:3100/api/agents/AGENT_ID \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.skills'
```

## Example: CEO Alert Workflow

```bash
#!/bin/bash
# CEO sends critical budget alert

# Create blocked issue (auto-notifies via Telegram)
ISSUE_RESPONSE=$(curl -s -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🚨 Budget threshold exceeded",
    "description": "Company budget at 95% - immediate review required",
    "status": "blocked",
    "priority": "critical",
    "assigneeAgentId": "cfo-agent-id"
  }')

ISSUE_ID=$(echo "$ISSUE_RESPONSE" | jq -r '.id')

# Add follow-up comment with @mention (also notifies)
curl -X POST "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "@CFO Please review budget allocation and propose cost reduction measures."
  }'

echo "Alert sent via issue: $ISSUE_ID"
```

## Troubleshooting

### Skill not available

```bash
# Import the skill
npx paperclipai skill import \
  --company-id YOUR_COMPANY_ID \
  --path skills/telegram-notify
```

### Plugin not configured

```bash
# Check plugin status
curl -s http://localhost:3100/api/plugins \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.[] | select(.packageName == "paperclip-plugin-telegram")'
```

### Messages not sending

1. Verify bot token is correct (test with getUpdates)
2. Check chat ID is correct
3. Ensure plugin is activated
4. Check Paperclip server logs

## Documentation

- **Skill reference:** `skills/telegram-notify/SKILL.md`
- **Plugin README:** `packages/plugins/plugin-telegram/README.md`
- **Usage guide:** `doc/telegram-plugin-usage-guide.md`
- **Paperclip skill:** `skills/paperclip/SKILL.md`

## Support

For issues or questions:
1. Check the plugin documentation
2. Review Paperclip server logs
3. Test bot token with Telegram API directly
4. Verify plugin configuration in Paperclip UI
