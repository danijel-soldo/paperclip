# Telegram Unread Issues Workflow Implementation Plan

**Date**: 2026-04-21  
**Status**: Ready for Implementation  
**Mode**: Plan

## Overview

Implement a custom Telegram bot workflow command that lists unread issues for the current user. This leverages the existing Paperclip API endpoint for unread issues and the telegram plugin's custom workflow command system.

## Background

### Existing Infrastructure

1. **Database**: `issue_read_states` table tracks `lastReadAt` per user/issue
2. **API Endpoint**: `GET /api/companies/:companyId/issues?unreadForUserId=me`
3. **Telegram Plugin**: Supports custom workflow commands via `/commands import`
4. **Workflow Steps**: `http_request`, `send_message`, `set_state`, etc.

### Key Discovery

The custom command system doesn't have a native "list issues" step, but we can use `http_request` to call the Paperclip API directly and format the response.

## Solution Design

### Workflow Command Structure

```json
{
  "name": "unread",
  "description": "List all unread issues for the current user",
  "steps": [
    {
      "id": "fetch_unread",
      "type": "http_request",
      "url": "{{paperclipBaseUrl}}/api/companies/{{companyId}}/issues?unreadForUserId=me&limit=50",
      "method": "GET",
      "headers": {
        "Authorization": "Bearer {{apiKey}}"
      }
    },
    {
      "id": "format_response",
      "type": "send_message",
      "text": "📬 **Unread Issues**\n\n{{fetch_unread.result}}"
    }
  ]
}
```

### Challenges Identified

1. **Template Variables**: The workflow needs access to:
   - `{{paperclipBaseUrl}}` - Internal API URL
   - `{{companyId}}` - Current company ID
   - `{{apiKey}}` - Authentication token

2. **Response Formatting**: The `http_request` step returns raw JSON, but we need formatted markdown for Telegram

3. **Authentication**: Board user context is needed for `unreadForUserId=me`

## Implementation Options

### Option 1: Enhanced HTTP Request Step (Recommended)

**Approach**: Extend the `http_request` workflow step to support:
- Auto-injection of `paperclipBaseUrl` and `companyId` from context
- Response transformation/formatting
- Automatic authentication header injection

**Pros**:
- Clean, reusable solution
- Works for other API calls too
- Maintains security (no exposed tokens)

**Cons**:
- Requires code changes to `command-registry.ts`
- More complex implementation

**Changes Required**:
```typescript
// In command-registry.ts executeStep()
case "http_request": {
  const url = interpolate(step.url)
    .replace(/\{\{paperclipBaseUrl\}\}/g, ctx.config.paperclipBaseUrl)
    .replace(/\{\{companyId\}\}/g, companyId);
  
  const headers = step.headers ? Object.fromEntries(
    Object.entries(step.headers).map(([k, v]) => [k, interpolate(v)])
  ) : {};
  
  // Auto-inject auth if not present
  if (!headers.Authorization && ctx.config.internalApiKey) {
    headers.Authorization = `Bearer ${ctx.config.internalApiKey}`;
  }
  
  const res = await ctx.http.fetch(url, {
    method: step.method,
    headers,
    body: step.body ? interpolate(step.body) : undefined,
  });
  
  const data = await res.json();
  
  // Format issues for display
  if (Array.isArray(data)) {
    const formatted = data.map((issue: any) => 
      `• ${issue.identifier || issue.id} - ${issue.title} (${issue.status})`
    ).join('\n');
    return formatted || 'No unread issues';
  }
  
  return JSON.stringify(data);
}
```

### Option 2: Dedicated "List Issues" Step

**Approach**: Add a new workflow step type `list_issues` with built-in formatting

**Pros**:
- Simpler workflow definition
- Better user experience
- Type-safe parameters

**Cons**:
- Less flexible
- Requires more code changes
- Only works for issues

**Changes Required**:
```typescript
type ListIssuesStep = WorkflowStepBase & {
  type: "list_issues";
  filters?: {
    unreadForUserId?: boolean;
    status?: string;
    projectId?: string;
  };
  format?: "compact" | "detailed";
};

case "list_issues": {
  const filters: any = { companyId };
  if (step.filters?.unreadForUserId) {
    filters.unreadForUserId = "me"; // Requires user context
  }
  if (step.filters?.status) {
    filters.status = interpolate(step.filters.status);
  }
  
  const issues = await ctx.issues.list(filters);
  
  if (issues.length === 0) {
    return "No unread issues";
  }
  
  const formatted = issues.map((issue: Issue) => 
    `• ${issue.identifier || issue.id} - ${issue.title} (${issue.status})`
  ).join('\n');
  
  return formatted;
}
```

### Option 3: Agent-Based Workflow

**Approach**: Use `invoke_agent` step to have an agent fetch and format unread issues

**Pros**:
- No code changes needed
- Flexible formatting via agent
- Can handle complex queries

**Cons**:
- Slower (agent invocation overhead)
- Costs tokens
- Less predictable output

**Workflow**:
```json
{
  "name": "unread",
  "description": "List unread issues",
  "steps": [
    {
      "id": "ask_agent",
      "type": "invoke_agent",
      "agentId": "{{ceoAgentId}}",
      "prompt": "List all unread issues for me in a compact format. Use the Paperclip API to fetch issues with unreadForUserId=me filter."
    },
    {
      "id": "send_result",
      "type": "send_message",
      "text": "{{ask_agent.result}}"
    }
  ]
}
```

## Recommended Approach

**Option 1: Enhanced HTTP Request Step** is recommended because:

1. **Reusable**: Benefits all custom commands that need API access
2. **Secure**: No token exposure in workflow definitions
3. **Flexible**: Works for any API endpoint
4. **Maintainable**: Centralized formatting logic

## Implementation Steps

### Phase 1: Code Changes (Switch to Code Mode)

1. **Update `command-registry.ts`**:
   - Add context variable interpolation (`{{paperclipBaseUrl}}`, `{{companyId}}`)
   - Add automatic auth header injection
   - Add response formatting for issue arrays
   - Add error handling for API failures

2. **Update `constants.ts`**:
   - Add `internalApiKey` to config schema (optional, for internal API calls)

3. **Update `manifest.ts`**:
   - Document new template variables in config schema

### Phase 2: Workflow Definition

Create the workflow JSON:

```json
{
  "name": "unread",
  "description": "List all unread issues for the current user",
  "steps": [
    {
      "id": "fetch_unread",
      "type": "http_request",
      "url": "{{paperclipBaseUrl}}/api/companies/{{companyId}}/issues?unreadForUserId=me&limit=50",
      "method": "GET"
    },
    {
      "id": "send_result",
      "type": "send_message",
      "text": "📬 **Unread Issues**\n\n{{fetch_unread.result}}"
    }
  ]
}
```

### Phase 3: Testing

1. Import the workflow: `/commands import <json>`
2. Test execution: `/unread`
3. Verify formatting and error handling
4. Test with no unread issues
5. Test with many unread issues (pagination)

### Phase 4: Documentation

Update `packages/plugins/plugin-telegram/README.md`:
- Add example workflow for unread issues
- Document template variables
- Document response formatting

## Alternative: Quick Implementation (No Code Changes)

If code changes are not desired, use **Option 3 (Agent-Based)** as a temporary solution:

```json
{
  "name": "unread",
  "description": "List unread issues via agent",
  "steps": [
    {
      "id": "ask_ceo",
      "type": "invoke_agent",
      "agentId": "{{arg0}}",
      "prompt": "Use the Paperclip API to list all issues with unreadForUserId=me filter. Format the results as a compact list with identifier, title, and status. If there are no unread issues, say 'No unread issues'."
    }
  ]
}
```

Usage: `/commands run unread <ceo-agent-id>`

## Success Criteria

- [ ] User can run `/unread` command in Telegram
- [ ] Command returns formatted list of unread issues
- [ ] Empty state handled gracefully ("No unread issues")
- [ ] Authentication works correctly (user context)
- [ ] Response is readable in Telegram (proper formatting)
- [ ] Error handling for API failures
- [ ] Documentation updated

## Security Considerations

1. **Authentication**: Workflow must use board user context for `unreadForUserId=me`
2. **Authorization**: Company access checks must be enforced
3. **Token Exposure**: API keys should not be in workflow definitions
4. **Rate Limiting**: Consider rate limits for API calls

## Future Enhancements

1. **Pagination**: Support for `?offset=` and `?limit=` parameters
2. **Filtering**: Add project/status filters as command arguments
3. **Mark as Read**: Add inline buttons to mark issues as read
4. **Notifications**: Proactive notifications for new unread issues
5. **Digest**: Include unread count in daily digest

## References

- Issue Read States Schema: `/packages/db/src/schema/issue_read_states.ts`
- Issues API Route: `/server/src/routes/issues.ts` (line 595+)
- Command Registry: `/packages/plugins/plugin-telegram/src/command-registry.ts`
- Telegram Plugin README: `/packages/plugins/plugin-telegram/README.md`

## Next Steps

1. **Decision**: Choose implementation option (recommend Option 1)
2. **Switch Mode**: Switch to `code` mode for implementation
3. **Implement**: Make code changes per chosen option
4. **Test**: Verify workflow execution
5. **Document**: Update README with example
