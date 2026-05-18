# Telegram Integration Architecture Analysis

## Overview

The `paperclip-plugin-telegram` is a comprehensive bidirectional Telegram bot integration for Paperclip that implements a "Chat OS" vision - turning Telegram into a command center for agent operations. The plugin is built on the Paperclip Plugin SDK and implements 5 major phases of functionality.

## Architecture Components

### 1. Core Plugin Structure

The plugin follows the standard Paperclip plugin architecture:

```
src/
├── index.ts          # Public exports
├── manifest.ts       # Plugin metadata and configuration schema
├── worker.ts         # Main plugin worker with event handlers
├── adapter.ts        # Platform abstraction layer
├── telegram-api.ts   # Low-level Telegram Bot API wrapper
├── formatters.ts     # Message formatting utilities
├── commands.ts       # Bot command handlers
├── acp-bridge.ts     # Multi-agent session management
├── escalation.ts     # Human-in-the-loop escalation system
├── media-pipeline.ts # Media processing (voice, images, etc.)
├── command-registry.ts # Custom workflow commands
├── watch-registry.ts # Proactive monitoring system
└── constants.ts      # Shared constants
```

### 2. Plugin Lifecycle (worker.ts)

The main worker implements the standard plugin lifecycle:

**Setup Phase:**
- Resolves bot token from secrets manager
- Registers bot commands with Telegram API
- Starts long-polling loop for incoming messages
- Sets up event subscriptions for Paperclip domain events
- Registers custom tools for agents
- Schedules periodic jobs (digest, escalation timeouts, watch checks)

**Event Handling:**
- Listens to Paperclip events: `issue.created`, `issue.updated`, `approval.created`, `agent.run.started`, etc.
- Formats and routes notifications to appropriate Telegram chats
- Supports per-company chat overrides and forum topic routing

**Inbound Message Processing:**
- Long-polling via `getUpdates` API
- Routes commands to command handlers
- Routes thread messages to active agent sessions
- Routes replies to original issues/escalations
- Handles media attachments

### 3. Platform Adapter Pattern (adapter.ts)

The `TelegramAdapter` class implements a `PlatformAdapter` interface, providing abstraction for:

- **Message sending**: `sendText()`, `sendButtons()`
- **Message editing**: `editMessage()`
- **Formatting**: `formatAgentLabel()`, `formatMention()`, `formatCodeBlock()`

This abstraction allows the core logic to be platform-agnostic, making it easier to support other platforms (Discord, Slack, etc.) in the future.

### 4. Telegram API Layer (telegram-api.ts)

Low-level wrapper around Telegram Bot API with:

- **Retry logic**: Handles rate limiting with exponential backoff
- **Fallback formatting**: Falls back to plain text if MarkdownV2 fails
- **Caching**: Caches forum status to reduce API calls
- **Error handling**: Comprehensive error logging and metrics

Key functions:
- `sendMessage()` - Send text with optional inline keyboard
- `editMessage()` - Edit existing messages
- `answerCallbackQuery()` - Respond to button clicks
- `setMyCommands()` - Register bot commands
- `escapeMarkdownV2()` - Escape special characters for Telegram's MarkdownV2

### 5. Five Implementation Phases

#### Phase 1: HITL Escalation (escalation.ts)

**Purpose**: Allow agents to escalate conversations to humans when stuck.

**Implementation**:
- Agents call `escalate_to_human` tool with reason, context, and suggested reply
- Creates escalation record with timeout and default action
- Posts to dedicated escalation channel with inline buttons:
  - "Send Suggested Reply" - Use agent's draft
  - "Reply" - Compose custom response
  - "Override" - Take over conversation
  - "Dismiss" - Close escalation
- Sends hold message to customer while waiting
- Routes human response back to originating chat
- Timeout handling with configurable default actions: `defer`, `auto_reply`, `close`

**Key Features**:
- Confidence scoring (0-1 scale)
- Conversation context preservation
- Multiple escalation reasons: low_confidence, explicit_request, policy_violation, unknown_intent
- Reply routing via native Paperclip API or ACP transport

#### Phase 2: Multi-Agent Threads (acp-bridge.ts)

**Purpose**: Enable multiple agents to collaborate in a single Telegram thread.

**Implementation**:
- Session registry tracks active agents per thread (max 5 configurable)
- Message routing strategies:
  - **@mention routing**: `@AgentName message` routes to specific agent
  - **Reply-to routing**: Reply to agent's message routes to that agent
  - **Fallback routing**: Most recently active agent receives unaddressed messages
- Agent tools:
  - `handoff_to_agent` - Transfer work with optional human approval
  - `discuss_with_agent` - Start conversation loop with another agent
- Conversation loop management:
  - Max turns limit
  - Human checkpoint pauses
  - Stale loop detection (auto-pause on repeated output)
  - Output sequencing to prevent interleaving
- Native-first spawning: Tries Paperclip agent sessions before ACP fallback
- Auto-spawn on handoff/discuss if target agent not in thread

**Key Features**:
- Handoff approval workflow with inline buttons
- Discussion loops with turn limits
- Agent presence indicators
- Cross-plugin event system for ACP output

#### Phase 3: Media Pipeline (media-pipeline.ts)

**Purpose**: Process voice, audio, video, documents, and photos.

**Implementation**:
- Detects media in incoming messages
- Voice/audio transcription via OpenAI Whisper API
- Posts transcription preview back to chat
- **Brief Agent** pattern:
  - Designated intake channels forward media to Brief Agent
  - Brief Agent triages and routes to appropriate handlers
- Active thread routing:
  - Media in agent threads routes to active session
  - Supports both native and ACP transports

**Supported Media Types**:
- Voice messages
- Audio files
- Video notes
- Documents
- Photos (with caption support)

#### Phase 4: Custom Workflow Commands (command-registry.ts)

**Purpose**: Allow users to create custom slash commands for multi-step workflows.

**Implementation**:
- `/commands import <json>` - Import workflow definition
- `/commands list` - Show registered commands
- `/commands run <name> [args]` - Execute workflow
- `/commands delete <name>` - Remove command
- Custom commands invocable as `/<name>` (cannot override built-ins)

**Workflow Step Types**:
- `fetch_issue` - Retrieve issue data
- `invoke_agent` - Start agent session
- `http_request` - Make HTTP call
- `send_message` - Post to Telegram
- `create_issue` - Create Paperclip issue
- `wait_approval` - Pause for human approval
- `set_state` - Store workflow state

**Template System**:
- `{{arg0}}`, `{{arg1}}`, etc. - Command arguments
- `{{args}}` - All arguments as string
- `{{prev.result}}` - Previous step result
- `{{step_id.result}}` - Specific step result

**Storage**: Per-company command registry in plugin state

#### Phase 5: Proactive Suggestions (watch-registry.ts)

**Purpose**: Agents register condition-based monitors that send proactive suggestions.

**Implementation**:
- Agents call `register_watch` tool with conditions and template
- Watch conditions support operators: `gt`, `lt`, `eq`, `ne`, `contains`, `exists`
- Evaluates against issues, agents, or custom state data
- Built-in templates: `invoice-overdue`, `lead-stale`
- Custom templates with `{{field}}` placeholder interpolation
- Scheduled job checks all watches periodically

**Rate Limiting & Deduplication**:
- Max suggestions per hour per company (default: 10)
- Deduplication window prevents re-firing same watch+entity (default: 24h)
- Tracks suggestion history in plugin state

**Built-in Templates**:
```javascript
{
  "invoice-overdue": "Invoice {{identifier}} is overdue by {{daysOverdue}} days",
  "lead-stale": "Lead {{identifier}} hasn't been contacted in {{daysSinceContact}} days"
}
```

### 6. Message Formatting (formatters.ts)

Implements MarkdownV2 formatting for all notification types:

- **Issue notifications**: Title, description, status, priority, assignee, project fields
- **Approval notifications**: Interactive buttons, linked issues, agent context
- **Agent lifecycle**: Run started/finished with status indicators
- **Error notifications**: Warning indicators and error details
- **Escalation notifications**: Context, suggested reply, confidence score

**Features**:
- Automatic MarkdownV2 escaping
- Fallback to plain text on formatting errors
- Truncation at word boundaries
- Issue link generation with company-specific prefixes
- Emoji indicators for status/priority

### 7. Bot Commands (commands.ts)

Built-in slash commands:

- `/status` - Active agents and recent completions
- `/issues` - List open issues
- `/agents` - List agents with status indicators
- `/approve <id>` - Approve pending approval
- `/help` - Display all commands
- `/connect <company>` - Link chat to Paperclip company
- `/connect_topic <project> <topic-id>` - Map forum topic to project
- `/acp spawn <agent>` - Start agent session in thread
- `/acp status` - Check ACP session status
- `/acp cancel` - Cancel running session
- `/acp close` - Close completed session
- `/commands import/list/run/delete` - Manage custom commands

**Command Registration**:
Commands are registered with Telegram via `setMyCommands()` API, making them appear in the bot's command menu.

### 8. Configuration System

The plugin uses Paperclip's configuration system with validation:

**Required Settings**:
- `telegramBotTokenRef` - Secret UUID for bot token (not raw token)

**Optional Settings**:
- Chat routing: `defaultChatId`, `approvalsChatId`, `errorsChatId`, `escalationChatId`
- URLs: `paperclipBaseUrl`, `paperclipPublicUrl`
- Features: `enableCommands`, `enableInbound`, `topicRouting`
- Digest: `digestMode`, `dailyDigestTime`, `bidailySecondTime`, `tridailyTimes`
- Escalation: `escalationTimeoutMs`, `escalationDefaultAction`, `escalationHoldMessage`
- Multi-agent: `maxAgentsPerThread`
- Media: `briefAgentId`, `briefAgentChatIds`, `transcriptionApiKeyRef`
- Watches: `maxSuggestionsPerHourPerCompany`, `watchDeduplicationWindowMs`

**Security**: Sensitive values (bot token, API keys) are stored in Paperclip's secrets manager and referenced by UUID.

### 9. State Management

The plugin uses Paperclip's state API for persistence:

**Scopes**:
- `instance` - Global plugin state (message mappings, chat mappings)
- `company` - Per-company state (chat overrides, custom commands, watches)

**Key State Patterns**:
- Message tracking: `msg_{chatId}_{messageId}` → entity mapping
- Chat mapping: `chat_{chatId}` → company mapping
- Topic routing: `topic_{chatId}_{projectName}` → thread ID
- Session registry: `session_{chatId}_{threadId}` → agent sessions
- Escalations: `escalation_{escalationId}` → escalation state
- Custom commands: `commands_{companyId}` → command definitions
- Watches: `watches_{companyId}` → watch definitions

### 10. Metrics & Observability

The plugin tracks metrics via `ctx.metrics.write()`:

- `telegram.messages.sent` - Successful message sends
- `telegram.messages.failed` - Failed message sends
- `telegram.inbound.routed` - Inbound messages routed to issues/escalations

Activity logging via `ctx.activity.log()` for audit trail.

### 11. Job Scheduling

Three periodic jobs:

1. **Daily Digest** (`telegram-daily-digest`)
   - Runs hourly, checks if current hour matches configured digest time
   - Supports daily, bidaily, tridaily modes
   - Generates summary of completed/created tasks, active agents, issue status

2. **Escalation Timeout Checker** (`check-escalation-timeouts`)
   - Runs periodically to check for timed-out escalations
   - Executes default action (defer/auto_reply/close)

3. **Watch Checker** (`check-watches`)
   - Evaluates all registered watches against current entity state
   - Sends proactive suggestions when conditions match
   - Enforces rate limits and deduplication

## Key Design Patterns

### 1. Adapter Pattern
Platform-specific logic isolated in `TelegramAdapter`, making it easy to support other platforms.

### 2. Event-Driven Architecture
Plugin reacts to Paperclip domain events rather than polling, ensuring real-time notifications.

### 3. State Machine Pattern
Escalations and agent sessions maintain state with clear transitions and timeout handling.

### 4. Template Pattern
Message formatting and custom commands use template interpolation for flexibility.

### 5. Registry Pattern
Command registry and watch registry provide extensible systems for user-defined behaviors.

### 6. Circuit Breaker Pattern
Retry logic with exponential backoff prevents cascading failures from Telegram API issues.

## Security Considerations

1. **Secret Management**: Bot tokens and API keys stored in Paperclip secrets, never in config
2. **Input Validation**: Command arguments validated before execution
3. **Rate Limiting**: Respects Telegram's rate limits with retry logic
4. **SSRF Protection**: Uses SDK methods instead of direct HTTP for internal API calls
5. **Scope Isolation**: Per-company state prevents cross-company data leakage

## Testing Strategy

The project includes ~80 tests covering:

- Notification formatting (MarkdownV2 escaping, truncation)
- Bot command parsing and execution
- Escalation lifecycle (creation, timeout, response)
- Session registry (routing, handoff, discuss)
- Media pipeline (transcription, Brief Agent routing)
- Custom command execution (template interpolation, step execution)
- Watch evaluation (condition matching, rate limiting)

## Deployment

- **Package**: Published to npm as `paperclip-plugin-telegram`
- **Installation**: Via Paperclip plugin API or npm install
- **Auto-publish**: GitHub Actions workflow publishes on push to `main` via OIDC
- **Dependencies**: Peer dependencies on `@paperclipai/plugin-sdk` and `@paperclipai/shared`

## Comparison with PR #407

The README notes this plugin supersedes an earlier monorepo example (PR #407) with:

- ✅ Bidirectional messaging (not just push notifications)
- ✅ Bot commands (/status, /issues, /agents, /approve, /acp, /commands)
- ✅ Inline buttons for approvals and escalations
- ✅ Reply routing (replies become issue comments)
- ✅ Forum topic routing
- ✅ Daily digest
- ✅ HITL escalation with suggested replies
- ✅ Multi-agent threads with handoff/discuss
- ✅ Media pipeline with transcription
- ✅ Custom workflow commands
- ✅ Proactive suggestions with watch conditions
- ✅ Standalone npm package (not monorepo example)

## Future Enhancements

Potential areas for expansion:

1. **Rich Media**: Support for sending images, files, voice messages from agents
2. **Inline Queries**: Support for inline bot queries (@botname query)
3. **Webhooks**: Alternative to long-polling for better scalability
4. **Group Management**: Admin commands for managing group settings
5. **Analytics Dashboard**: Visualization of bot usage metrics
6. **Multi-language**: i18n support for notifications and commands
7. **Custom Keyboards**: Reply keyboards for guided workflows
8. **Payment Integration**: Telegram Payments API for transactions

## Conclusion

The `paperclip-plugin-telegram` demonstrates a sophisticated implementation of the Paperclip Plugin SDK, showcasing:

- Clean separation of concerns with adapter pattern
- Comprehensive event handling and state management
- Advanced features like multi-agent collaboration and proactive monitoring
- Production-ready error handling and observability
- Extensibility through custom commands and watches

The "Chat OS" vision transforms Telegram from a simple notification channel into a full-featured command center for agent operations, enabling human-agent collaboration at scale.
