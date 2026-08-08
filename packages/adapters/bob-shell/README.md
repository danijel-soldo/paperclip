# Bob Shell Adapter for Paperclip

Run Paperclip agents on **Bob Shell** as their execution runtime. Provides
workspace materialization, MCP wiring back to Paperclip, skill projection,
process lifecycle management, prompt-bundle caching, and error
classification with retry.

## Architecture

```
Paperclip Agent (bob_shell)
    ↓
Prompt Bundle Cache (content-addressed)
    ↓
Workspace Sync (.bob/ generation)
    ↓
Bob Shell Process
    ↓
Bob Shell  ← MCP →  Paperclip API
```

## Generated workspace files

When a Bob Shell agent runs, the adapter writes the following into the
agent's working directory:

### `.bob/mcp.json`

Configures the Paperclip MCP server. Sensitive and per-run values are
written as `${VAR}` placeholders that Bob Shell expands from its
parent-process environment at MCP startup — they never land on disk:

- `PAPERCLIP_API_URL` — placeholder
- `PAPERCLIP_API_KEY` — placeholder (secret)
- `PAPERCLIP_RUN_ID` — placeholder
- `PAPERCLIP_COMPANY_ID` — inlined (stable per-agent)
- `PAPERCLIP_AGENT_ID` — inlined (stable per-agent)

Other MCP servers in this file are preserved.

### `.bob/rules-paperclip/`

Markdown instruction files generated per run:

- `01-core.md` — core Paperclip agent rules
- `02-repo.md` — repository context
- `03-tasking.md` — task workflow
- `04+` — projected company skills (symlinked from the skill source)

This directory is fully managed by the adapter and cleared on each sync.

## Configuration

Agent `adapterConfig` fields:

| Field | Default | Description |
|---|---|---|
| `command` | `bob` | Bob Shell executable on PATH or absolute path |
| `cwd` | _agent default_ | Working directory for the run |
| `extraArgs` | `[]` | Additional CLI arguments passed to the `bob` command |
| `env` | `{}` | Extra environment variables (`KEY=VALUE`) |
| `workspaceStrategy` | _none_ | Optional `{ type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }` |
| `timeoutSec` | `0` | Run timeout, `0` = no timeout |
| `graceSec` | `20` | SIGTERM grace before SIGKILL |
| `promptTemplate` | _empty_ | Heartbeat prompt template (rendered each run) |
| `bootstrapPromptTemplate` | _empty_ | Prompt rendered only on the first turn of a new session |
| `maxRetries` | `2` | Retry attempts on retryable errors |
| `retryDelayMs` | `1000` | Base delay in ms; exponential backoff |
| `modeConfig` | `{}` | Opaque config object; included in the prompt-bundle cache key |
| `instructionsFilePath` | _none_ | Path to an external agent instructions file |

Bob Shell is launched in its default mode. No `custom_modes.yaml` is
generated and no `--mode` flag is passed. Use `extraArgs` to pass
`--mode <slug>` explicitly if you need a specific Bob mode.

## Error handling

Errors are classified into eight categories. Retryable errors are
retried with exponential backoff (`maxRetries`, `retryDelayMs`).

| Type | Codes | Retryable |
|---|---|---|
| `session` | `session_not_found`, `session_expired`, `session_corrupted` | yes (with fresh session) |
| `api` | `api_rate_limit`, `api_timeout`, `api_server_error` | yes |
| `auth` | `auth_invalid`, `auth_required` | no |
| `config` | `config_invalid` | no |
| `execution` | `tool_error`, `user_cancelled`, `execution_error` | no |
| `timeout` | `timeout` | no |
| `max_turns` | `max_turns` | no |
| `unknown` | `unknown` | no |

## Prompt bundle caching

Workspace sync output is content-addressed. Bundle keys are derived from
a hash of the skills, instructions, and mode config; identical inputs
reuse the existing bundle and skip re-syncing.

Cache location:

```
~/.paperclip/instances/{instance_id}/companies/{company_id}/bob-prompt-cache/{bundle_key}/
```

The cache grows over time. Manual cleanup:

```bash
find ~/.paperclip/instances/*/companies/*/bob-prompt-cache \
  -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
```

## Workspace sync semantics

- **Managed**: the `paperclip` MCP server entry in `mcp.json` and the
  `rules-paperclip/` directory.
- **Preserved**: any other MCP servers in `mcp.json` and any other
  files under `.bob/`.
- **Deterministic**: same skills + config produce the same `.bob/`
  output.

## Development

```bash
pnpm install

# Build
pnpm --filter @paperclipai/adapter-bob-shell build

# Typecheck
pnpm --filter @paperclipai/adapter-bob-shell typecheck

# Tests
pnpm --filter @paperclipai/adapter-bob-shell test
```

The adapter can also be exercised via the Paperclip UI:
**Settings → Agents → _agent_ → Test Environment**.

## Troubleshooting

**`command not found: bob`** — install Bob Shell and put it on `PATH`,
or set an absolute path in `adapterConfig.command`.

**MCP connection failures** — confirm `PAPERCLIP_API_URL` is reachable
from the Bob Shell process and `PAPERCLIP_API_KEY` is set in the parent
process environment.

**`.bob/` not generated** — check write permissions on the agent's
working directory and look for sync errors in the run logs.

**Retries exhausted** — inspect the error classification in the logs;
non-retryable errors (config, execution, timeout) will not be retried
regardless of `maxRetries`.

**Cache misbehaving** — check write permissions on the cache directory;
deleting the cache directory is safe and forces a clean sync on the
next run.

## Security

- The `PAPERCLIP_API_KEY` is never written to `.bob/mcp.json`; it is
  passed through as a `${PAPERCLIP_API_KEY}` placeholder and supplied
  by the parent process environment at MCP startup.
- Bob Shell inherits the permissions of the Paperclip server process.
- Prompt bundles may contain sensitive instructions; the cache
  directory is under `~/.paperclip` and should be protected
  accordingly.

## Setup guide

See [`docs/SETUP.md`](./docs/SETUP.md) for end-to-end installation,
agent configuration, and walkthrough.
