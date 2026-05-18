# Telegram Plugin Usage Guide

## Overview

The `paperclip-plugin-telegram` enables bidirectional Telegram integration with Paperclip. This guide shows how to send Telegram messages from agents.

## Quick Start: Sending Messages

### Method 1: Via Paperclip Events (Automatic)

The plugin automatically sends Telegram notifications when Paperclip events occur:

- **Issue created** → Notification sent
- **Issue completed** → Notification sent  
- **Approval requested** → Interactive buttons sent
- **Agent error** → Error notification sent
- **Agent run started/finished** → Lifecycle notifications

**No code needed** - just configure the plugin and it works automatically.

### Method 2: Via Paperclip API (Manual Trigger)

If you need to send custom messages, you can trigger events through the Paperclip API:

```bash
# Example: Create an issue (triggers notification)
curl -X POST http://localhost:3100/api/companies/{companyId}/issues \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "title": "Alert: Issue blocked",
    "description": "Task XYZ is blocked and needs attention",
    "status": "blocked",
    "priority": "high"
  }'
```

### Method 3: Direct Telegram API (Advanced)

For direct control, use the Telegram Bot API:

```bash
# Send a message directly via Telegram API
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "YOUR_CHAT_ID",
    "text": "Alert: Issue blocked",
    "parse_mode": "MarkdownV2"
  }'
```

**Note:** You need the bot token and chat ID from your plugin configuration.

## Configuration Required

Before sending messages, ensure the plugin is configured:

1. **Install the plugin:**
   ```bash
   curl -X POST http://localhost:3100/api/plugins/install \
     -H "Content-Type: application/json" \
     -d '{"packageName":"paperclip-plugin-telegram"}'
   ```

2. **Configure settings:**
   - `telegramBotTokenRef` - Secret UUID for your bot token (required)
   - `defaultChatId` - Default chat for notifications
   - `approvalsChatId` - Separate chat for approvals (optional)
   - `errorsChatId` - Separate chat for errors (optional)
   - `escalationChatId` - Dedicated chat for escalations (optional)

3. **Get your bot token:**
   - Chat with [@BotFather](https://t.me/BotFather)
   - Run `/newbot` and follow prompts
   - Save the bot token

4. **Get your chat ID:**
   ```bash
   # Send a message to your bot, then run:
   curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
   # Find the "chat.id" field in the response
   ```

## Code Examples

### Example 1: Send Alert via Issue Creation

```typescript
// Create a blocked issue (triggers Telegram notification)
const response = await fetch('http://localhost:3100/api/companies/123/issues', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    title: 'Alert: Issue blocked',
    description: 'Task XYZ requires immediate attention',
    status: 'blocked',
    priority: 'high',
    projectId: 'project-456'
  })
});
```

### Example 2: Direct Telegram Message

```typescript
// Send message directly via Telegram API
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const response = await fetch(
  `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: 'Alert: Issue blocked',
      parse_mode: 'MarkdownV2'
    })
  }
);
```

### Example 3: Using Plugin's sendMessage Function

If you have access to the plugin context:

```typescript
import { sendMessage } from 'paperclip-plugin-telegram/src/telegram-api.js';

// Inside a plugin or worker with PluginContext
await sendMessage(
  ctx,                    // PluginContext
  botToken,              // Your bot token
  chatId,                // Destination chat ID
  'Alert: Issue blocked', // Message text
  {
    parseMode: 'MarkdownV2',
    disableNotification: false
  }
);
```

## Agent Tools Available

The plugin provides these tools for agents:

1. **`escalate_to_human`** - Escalate when stuck (low confidence, user request, etc.)
2. **`handoff_to_agent`** - Hand off work to another agent
3. **`discuss_with_agent`** - Start conversation with another agent
4. **`register_watch`** - Set up proactive monitoring

## Bot Commands Available

Users can interact with the bot via these commands:

- `/status` - Show active agents and recent completions
- `/issues` - List open issues
- `/agents` - List agents with status
- `/approve <id>` - Approve a pending approval
- `/help` - Display all commands
- `/connect <company>` - Link chat to a company
- `/acp spawn <agent>` - Start agent session in thread

## File Locations

- **Plugin source:** `/home/vpcuser/paperclip/packages/plugins/plugin-telegram/`
- **Main API module:** `packages/plugins/plugin-telegram/src/telegram-api.ts`
- **Adapter:** `packages/plugins/plugin-telegram/src/adapter.ts`
- **Worker:** `packages/plugins/plugin-telegram/src/worker.ts`
- **README:** `packages/plugins/plugin-telegram/README.md`

## Recommended Approach for Agents

**For most use cases, use Method 1 (Automatic Events):**

1. Configure the plugin with your bot token and chat IDs
2. Let Paperclip events trigger notifications automatically
3. Use issue creation/updates to send alerts:
   ```bash
   # Create a blocked issue → Telegram notification sent automatically
   curl -X POST http://localhost:3100/api/companies/{companyId}/issues \
     -H "Content-Type: application/json" \
     -d '{"title":"Alert","status":"blocked","priority":"high"}'
   ```

**For custom messages, use Method 3 (Direct API):**

```bash
# Direct Telegram API call
curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"${CHAT_ID}","text":"Custom alert message"}'
```

## Environment Variables Needed

```bash
# For direct API calls
export TELEGRAM_BOT_TOKEN="your-bot-token-here"
export TELEGRAM_CHAT_ID="your-chat-id-here"

# For Paperclip API calls
export PAPERCLIP_API_KEY="your-api-key-here"
export PAPERCLIP_COMPANY_ID="your-company-id-here"
```

## Troubleshooting

1. **Plugin not sending messages?**
   - Check plugin is installed: `curl http://localhost:3100/api/plugins`
   - Verify bot token is configured correctly
   - Check chat ID is correct

2. **Messages not formatted correctly?**
   - Use `MarkdownV2` parse mode
   - Escape special characters: `_*[]()~`>#+\-=|{}.!\\`
   - Or use plain text (no parse_mode)

3. **Rate limited?**
   - Telegram has rate limits (30 messages/second per chat)
   - Plugin automatically retries with backoff

## Summary

**Simplest approach for agents:**

```bash
# 1. Get your bot token and chat ID (one-time setup)
# 2. Send message via Telegram API:
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "YOUR_CHAT_ID",
    "text": "Alert: Issue blocked"
  }'
```

That's it! No complex setup needed for basic alerts.
