# GitHub Webhook Integration

## Overview

The GitHub webhook integration enables automatic Paperclip issue creation from tagged Git commits. When developers push commits with the `NEW_ISSUE:` tag, the webhook receiver creates corresponding issues in Paperclip with full origin tracking.

## Features

- **Automatic Issue Creation**: Commits tagged with `NEW_ISSUE:` automatically create Paperclip issues
- **Origin Tracking**: Issues link back to source commits with full metadata
- **Security**: HMAC-SHA256 signature verification with constant-time comparison
- **Duplicate Prevention**: Delivery ID tracking prevents duplicate issue creation
- **Metadata Support**: Parse priority, labels, and descriptions from commit messages

## Setup

### 1. Configure Environment Variables

```bash
# Required: Webhook secret (must match GitHub webhook configuration)
GITHUB_WEBHOOK_SECRET=your-secret-here

# Required: Target company for created issues
GITHUB_WEBHOOK_DEFAULT_COMPANY_ID=company-uuid

# Optional: Target project for created issues
GITHUB_WEBHOOK_DEFAULT_PROJECT_ID=project-uuid
```

### 2. Configure GitHub Webhook

1. Go to your GitHub repository settings
2. Navigate to **Webhooks** → **Add webhook**
3. Configure:
   - **Payload URL**: `https://your-paperclip-instance.com/api/webhooks/github/push`
   - **Content type**: `application/json`
   - **Secret**: Same value as `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Just the push event"
   - **Active**: ✓ Enabled

### 3. Generate Strong Secret

```bash
# Generate a secure random secret (32 characters)
openssl rand -hex 32
```

## Commit Message Format

### Basic Issue

```
NEW_ISSUE: Issue title here

Optional description goes here.
Can span multiple lines.
```

### With Priority

```
NEW_ISSUE: Critical bug in authentication
PRIORITY: critical

Detailed description of the bug.
```

**Valid priorities**: `critical`, `high`, `medium`, `low`

### With Labels

```
NEW_ISSUE: Add user profile page
LABELS: feature, frontend, ui

Description of the feature.
```

### Complete Example

```
NEW_ISSUE: Fix memory leak in background worker
PRIORITY: high
LABELS: bug, performance, backend

The background worker is accumulating memory over time.
After 24 hours of operation, memory usage reaches 2GB.

Steps to reproduce:
1. Start the worker
2. Monitor memory usage over 24 hours
3. Observe gradual increase

Expected: Memory should remain stable
Actual: Memory increases continuously
```

## API Endpoint

### POST /api/webhooks/github/push

Receives GitHub push events and creates issues for tagged commits.

**Headers:**
- `X-Hub-Signature-256`: HMAC-SHA256 signature (required)
- `X-GitHub-Delivery`: Unique delivery ID (required)
- `Content-Type`: application/json

**Request Body:**
```json
{
  "ref": "refs/heads/main",
  "repository": {
    "id": 12345,
    "name": "repo-name",
    "full_name": "org/repo-name",
    "html_url": "https://github.com/org/repo-name"
  },
  "commits": [
    {
      "id": "abc123...",
      "message": "NEW_ISSUE: Issue title\n\nDescription",
      "timestamp": "2026-05-06T12:00:00Z",
      "url": "https://github.com/org/repo-name/commit/abc123",
      "author": {
        "name": "Developer Name",
        "email": "dev@example.com",
        "username": "devuser"
      },
      "committer": {
        "name": "Developer Name",
        "email": "dev@example.com",
        "username": "devuser"
      }
    }
  ],
  "pusher": {
    "name": "Developer Name",
    "email": "dev@example.com"
  }
}
```

**Success Response (200):**
```json
{
  "message": "Webhook processed successfully",
  "deliveryId": "unique-delivery-id",
  "issuesCreated": [
    {
      "issueId": "issue-uuid",
      "commitId": "abc123...",
      "title": "Issue title"
    }
  ]
}
```

**Error Responses:**
- `400`: Missing delivery ID or invalid payload
- `401`: Invalid webhook signature
- `500`: Internal server error

## Origin Tracking

Created issues include origin metadata linking back to the source commit:

```json
{
  "origin": {
    "kind": "github_commit",
    "id": "abc123...",
    "metadata": {
      "repository": "org/repo-name",
      "repositoryId": 12345,
      "commitSha": "abc123...",
      "commitUrl": "https://github.com/org/repo-name/commit/abc123",
      "commitMessage": "Full commit message",
      "commitTimestamp": "2026-05-06T12:00:00Z",
      "author": {
        "name": "Developer Name",
        "email": "dev@example.com",
        "username": "devuser"
      },
      "pusher": {
        "name": "Developer Name",
        "email": "dev@example.com"
      },
      "ref": "refs/heads/main"
    }
  }
}
```

## Security

### Signature Verification

All webhook requests must include a valid HMAC-SHA256 signature:

1. GitHub generates signature: `HMAC-SHA256(secret, request_body)`
2. Signature sent in `X-Hub-Signature-256` header as `sha256=<hex>`
3. Server verifies using constant-time comparison
4. Invalid signatures rejected with 401 status

### Best Practices

1. **Strong Secret**: Use 32+ character random secret
2. **HTTPS Only**: Configure webhook with HTTPS URL
3. **Secret Rotation**: Rotate webhook secret periodically
4. **Firewall**: Restrict webhook endpoint to GitHub IPs
5. **Monitoring**: Alert on signature verification failures

### GitHub Webhook IPs

Configure firewall to allow only GitHub's webhook IPs:
https://api.github.com/meta (see `hooks` field)

## Duplicate Prevention

The webhook uses GitHub's `X-GitHub-Delivery` header to prevent duplicate issue creation:

1. Each webhook delivery has unique ID
2. Server tracks processed delivery IDs
3. Duplicate deliveries return 200 but skip processing
4. Prevents issues from GitHub webhook retries

**Note**: Phase 1A uses in-memory tracking. Phase 1B will add persistent database tracking.

## Monitoring

### Logs

Webhook activity is logged with structured data:

```
INFO: Creating issue from GitHub commit
  commitId: abc123...
  repository: org/repo-name
  title: Issue title

INFO: GitHub webhook processed successfully
  deliveryId: unique-id
  repository: org/repo-name
  commitsProcessed: 3
  issuesCreated: 2

WARN: GitHub webhook signature verification failed
  signature: sha256=...
  hasRawBody: true
```

### Metrics

Monitor these metrics for webhook health:

- Webhook delivery success rate
- Signature verification failure rate
- Issue creation rate per repository
- Processing latency

## Troubleshooting

### Webhook Not Triggering

1. Check GitHub webhook configuration is active
2. Verify payload URL is correct and accessible
3. Check GitHub webhook delivery logs for errors
4. Ensure HTTPS certificate is valid

### Signature Verification Failing

1. Verify `GITHUB_WEBHOOK_SECRET` matches GitHub configuration
2. Check webhook secret has no leading/trailing whitespace
3. Ensure request body is not modified by middleware
4. Verify `rawBody` is preserved in Express configuration

### Issues Not Created

1. Check `GITHUB_WEBHOOK_DEFAULT_COMPANY_ID` is set
2. Verify company ID exists in database
3. Check commit message has correct `NEW_ISSUE:` format
4. Review server logs for error details

### Duplicate Issues

1. Verify delivery ID tracking is working
2. Check for webhook configuration duplicates
3. Review GitHub webhook delivery logs

## Testing

### Unit Tests

```bash
cd server
pnpm vitest run src/routes/webhooks/github.test.ts
```

### Integration Tests

```bash
cd server
pnpm vitest run src/routes/webhooks/github.integration.test.ts
```

### Manual Testing

```bash
# Generate test signature
SECRET="your-secret"
PAYLOAD='{"ref":"refs/heads/main","repository":{"id":1,"name":"test","full_name":"org/test","html_url":"https://github.com/org/test"},"commits":[{"id":"abc123","message":"NEW_ISSUE: Test\n\nDescription","timestamp":"2026-05-06T12:00:00Z","url":"https://github.com/org/test/commit/abc123","author":{"name":"Test","email":"test@example.com"},"committer":{"name":"Test","email":"test@example.com"}}],"pusher":{"name":"Test","email":"test@example.com"}}'
SIGNATURE="sha256=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)"

# Send test webhook
curl -X POST http://localhost:3100/api/webhooks/github/push \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -H "X-GitHub-Delivery: test-delivery-$(date +%s)" \
  -d "$PAYLOAD"
```

## Future Enhancements

### Phase 1B
- Persistent delivery tracking in database
- Delivery tracking TTL and cleanup

### Phase 2
- Webhook registration UI
- Multi-company routing
- Per-repository configuration
- Rate limiting per repository

### Phase 3
- Support for other GitHub events (issues, pull requests)
- Bidirectional sync (Paperclip → GitHub)
- Custom issue templates per repository
- Webhook health dashboard

## References

- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [Securing Webhooks](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- Security Review: `./SECURITY_REVIEW.md`
- Implementation: `./github.ts`
- Tests: `./github.test.ts`, `./github.integration.test.ts`
