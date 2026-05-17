# Skill: paperclipai/paperclip/telegram-notify

---
name: telegram-notify
description: >
  Send Telegram notifications and alerts through the paperclip-plugin-telegram.
  Use when you need to notify stakeholders, send alerts, or communicate important
  updates via Telegram. Supports direct API calls and automatic event-based
  notifications through Paperclip's issue system.
---

# Telegram Notify Skill

Send Telegram messages and alerts to configured chat channels.

## Prerequisites

The `paperclip-plugin-telegram` must be installed and configured with:
- `telegramBotTokenRef` - Secret UUID for bot token
- `defaultChatId` - Default destination chat
- Optional: `approvalsChatId`, `errorsChatId`, `escalationChatId` for routing

## Authentication

Required environment variables (auto-injected in Paperclip context):
- `PAPERCLIP_API_URL` - Paperclip API base URL
- `PAPERCLIP_API_KEY` - API authentication token
- `PAPERCLIP_COMPANY_ID` - Your company ID

For direct Telegram API calls (advanced):
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `TELEGRAM_CHAT_ID` - Destination chat ID

## Quick Start

### Method 1: Via Paperclip Issues (Recommended)

Create or update issues to trigger automatic Telegram notifications:

```bash
# Create a high-priority blocked issue (triggers notification)
curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Alert: Critical issue blocked",
    "description": "Production deployment blocked - requires immediate attention",
    "status": "blocked",
    "priority": "critical",
    "projectId": "project-id-here"
  }'
```

### Method 2: Direct Telegram API (Advanced)

Send messages directly via Telegram Bot API:

```bash
# Get bot token from Paperclip secrets
TELEGRAM_BOT_TOKEN=$(curl -s "$PAPERCLIP_API_URL/api/secrets/$TELEGRAM_BOT_TOKEN_REF" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" | jq -r '.value')

# Send message
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"$TELEGRAM_CHAT_ID"'",
    "text": "Alert: Critical issue requires attention",
    "parse_mode": "MarkdownV2"
  }'
```

## Common Use Cases

### 1. Send Critical Alert

```bash
# Create critical issue (auto-notifies via Telegram)
curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "🚨 Production Down",
    "description": "Service unavailable - investigating",
    "status": "blocked",
    "priority": "critical"
  }'
```

### 2. Request Approval

```bash
# Create approval request (sends interactive buttons to Telegram)
curl -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "request_board_approval",
    "requestedByAgentId": "'"$PAPERCLIP_AGENT_ID"'",
    "issueIds": ["issue-id-here"],
    "payload": {
      "title": "Approve vendor contract",
      "summary": "Annual cost: $50k for service X",
      "recommendedAction": "Approve and proceed with onboarding",
      "risks": ["Vendor lock-in", "Cost increase after year 1"]
    }
  }'
```

### 3. Send Status Update

```bash
# Update issue status (triggers completion notification)
curl -X PATCH "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "done",
    "comment": "Deployment completed successfully. All systems operational."
  }'
```

### 4. Escalate to Human

```bash
# Agent escalation (if agent has escalate_to_human tool)
# This is typically called from within an agent's execution context
# The plugin handles routing to the escalationChatId
```

## Notification Types

The plugin automatically sends notifications for:

| Event | Trigger | Destination |
|-------|---------|-------------|
| Issue created | New issue | `defaultChatId` |
| Issue completed | Status → done | `defaultChatId` |
| Approval requested | New approval | `approvalsChatId` or default |
| Agent error | Agent failure | `errorsChatId` or default |
| Agent escalation | `escalate_to_human` tool | `escalationChatId` or default |
| Run started/finished | Agent lifecycle | `defaultChatId` |

## Message Formatting

### MarkdownV2 (Recommended)

```bash
# Escape special characters: _*[]()~`>#+\-=|{}.!\
TEXT="*Bold* text with \\[escaped brackets\\]"

curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"$TELEGRAM_CHAT_ID"'",
    "text": "'"$TEXT"'",
    "parse_mode": "MarkdownV2"
  }'
```

### Plain Text (Fallback)

```bash
# No escaping needed
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "'"$TELEGRAM_CHAT_ID"'",
    "text": "Simple alert message - no formatting"
  }'
```

## Configuration Check

Verify plugin is installed and configured:

```bash
# List installed plugins
curl -s "$PAPERCLIP_API_URL/api/plugins" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" | jq '.[] | select(.packageName == "paperclip-plugin-telegram")'

# Check plugin configuration
curl -s "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/plugins/telegram" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" | jq '.config'
```

## Bot Commands

Users can interact with the bot via these commands:

- `/status` - Show active agents and recent completions
- `/issues` - List open issues
- `/agents` - List agents with status
- `/approve <id>` - Approve a pending approval
- `/help` - Display all commands
- `/connect <company>` - Link chat to a company

## Troubleshooting

### Plugin not installed

```bash
# Install the plugin
curl -X POST "$PAPERCLIP_API_URL/api/plugins/install" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"packageName":"paperclip-plugin-telegram"}'
```

### Messages not sending

1. Verify bot token is configured correctly
2. Check chat ID is correct
3. Ensure plugin is activated
4. Check Paperclip logs for errors

### Rate limiting

Telegram limits: 30 messages/second per chat. The plugin automatically retries with backoff.

## Best Practices

1. **Use issue-based notifications** for most alerts (Method 1)
2. **Reserve direct API calls** for custom messages outside Paperclip's event system
3. **Set appropriate priority** on issues to control notification urgency
4. **Use dedicated chat IDs** for different notification types (approvals, errors, escalations)
5. **Keep messages concise** - Telegram has a 4096 character limit per message
6. **Use MarkdownV2** for formatted messages, plain text for simple alerts

## Reference Documentation

- Full plugin README: `packages/plugins/plugin-telegram/README.md`
- API module: `packages/plugins/plugin-telegram/src/telegram-api.ts`
- Usage guide: `doc/telegram-plugin-usage-guide.md`
- Paperclip API: `skills/paperclip/SKILL.md`

## Example: CEO Alert Workflow

```bash
#!/bin/bash
# Send critical alert as CEO agent

# 1. Create blocked issue (triggers Telegram notification)
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

# 2. Add follow-up comment (also notifies)
curl -X POST "$PAPERCLIP_API_URL/api/issues/$ISSUE_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "@CFO Please review budget allocation and propose cost reduction measures."
  }'

echo "Alert sent via issue: $ISSUE_ID"
```

## Summary

**Recommended approach:**
1. Use Paperclip's issue system for most notifications (automatic)
2. Create/update issues with appropriate status and priority
3. Let the plugin handle Telegram delivery
4. Use direct API only for custom messages outside Paperclip events

**Environment variables needed:**
- `PAPERCLIP_API_URL`
- `PAPERCLIP_API_KEY`
- `PAPERCLIP_COMPANY_ID`
- (Optional) `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for direct API calls

