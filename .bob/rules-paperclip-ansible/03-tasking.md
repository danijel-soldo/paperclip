# Tasking Workflow

## Issue Lifecycle

1. **Checkout** - Claim an issue before starting work
2. **Work** - Make changes, run tests, validate
3. **Update** - Add comments and update status
4. **Complete** - Mark done when finished

## Approval Gates

Some actions require approval:
- Deployment operations
- External API calls
- Budget-impacting decisions
- Security-sensitive changes

Request approval via Paperclip MCP tools when needed.

## Budget Management

- Monitor token usage
- Respect configured budget limits
- Auto-pause triggers when budget is exhausted
- Resume work after budget is replenished
