export const type = "bob_shell";
export const label = "Bob Shell (local)";

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# bob_shell agent configuration

Adapter: bob_shell

Core fields:
- cwd (string, optional): default absolute working directory for the Bob Shell process (created if missing when possible)
- command (string, optional): Bob Shell executable command (defaults to "bob")
- extraArgs (string[], optional): additional CLI arguments to pass to Bob Shell (e.g. ["--mode", "plan"])
- modeConfig (object, optional): opaque config object; included in the prompt-bundle cache key
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): reserved for workspace runtime metadata

Operational fields:
- timeoutSec (number, optional): run timeout in seconds (0 for no timeout)
- graceSec (number, optional): SIGTERM grace period in seconds before SIGKILL

Bob Shell Integration:
- Paperclip generates .bob/ workspace configuration before launching Bob Shell
- Generated files include:
  - .bob/mcp.json (managed "paperclip" MCP server entry)
  - .bob/rules-paperclip/*.md (runtime instructions and company skills)
- Bob Shell is launched in its default mode; no custom_modes.yaml is written and no --mode flag is passed
- To use a specific Bob mode, pass it via extraArgs: ["--mode", "<slug>"]
- Bob Shell connects back to Paperclip via the Paperclip MCP server
- Paperclip injects runtime context via environment variables:
  - PAPERCLIP_API_URL
  - PAPERCLIP_API_KEY
  - PAPERCLIP_COMPANY_ID
  - PAPERCLIP_AGENT_ID
  - PAPERCLIP_RUN_ID
  - PAPERCLIP_TASK_ID (when applicable)
  - PAPERCLIP_WORKSPACE_* (workspace context)

Notes:
- Bob Shell must be installed and available in PATH or via the configured command
- The "paperclip" MCP server entry in .bob/mcp.json is managed and will be overwritten on each run
- Other MCP servers and files in .bob/ are preserved
`;
