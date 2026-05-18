# Repository Alignment Analysis - OCP-66

## Executive Summary

**The fork is already ahead and aligned.** No merge from running instance needed.

## Repository Status

### Running Instance (/home/vpcuser/paperclip)
- HEAD: `21055581` (fix(server): comment out broken webhooks import)
- Branch: master
- 3 unique commits after common ancestor `685ee84e`
- 66 untracked files (mostly .bob/ config, doc/plans/, telegram plugin)

### Fork (/home/vpcuser/upstream-paperclip/paperclip)
- HEAD: `d097e4b4` (fix(server): comment out broken webhooks import)
- Branch: master (synced with origin/master at danijel-soldo/paperclip)
- 35 commits after common ancestor `685ee84e`
- Only 3 modified runtime files (.bob/mcp.json, .bob/custom_modes.yaml, .bob/notes/pending-notes.txt)

## Critical Finding

**The fork already has all essential changes from running instance:**

1. ✅ Bob-shell cwd fix
   - Running: `cdf10c3f` (48 files, 7,214 insertions - bloated)
   - Fork: `efe7ffe1` (2 files, 121 insertions - clean)

2. ✅ Role-based mode derivation
   - Running: `3ffa57f4`
   - Fork: `e2e53260` (same feature)

3. ✅ Webhooks fix
   - Running: `21055581`
   - Fork: `d097e4b4` (same fix)

**Plus fork has 32 additional commits including:**
- Monitor features (issue-monitor-scheduler, IssueMonitorActivityCard)
- Execution policy enhancements (doc/execution-semantics.md updates)
- Test coverage (adapter tests, heartbeat tests, recovery tests)
- Database migration (0075_cultured_sebastian_shaw.sql)
- UI improvements (agent config, issue properties, onboarding)

## Comparison Analysis

Excluding .bob/ and doc/plans/:
- **240 files changed**
- **2,510 insertions, 41,872 deletions** (running instance has significant bloat)
- Fork has cleaner bob-shell implementation
- Fork has more tests and product features

## What Running Instance Has (not in fork)

### 1. Bloated bob-shell commit (cdf10c3f)
- BOB_SHELL_OUTPUT_FORMAT.md, DASHBOARD_STATUS_UPDATES.md
- DEBUG.md, MCP_TOOLS_VERIFICATION.md
- diagnose-mcp.sh, bootstrap-prompt.test.ts, test-parse.ts
- Many ._ (AppleDouble) files

### 2. Untracked local files
- packages/plugins/plugin-telegram/
- skills/telegram-notify/
- doc/plans/ (40+ planning documents)
- .bob/ runtime config
- Various debug/analysis docs

## Recommendation

**DO NOT push running instance commits to fork.**

The fork is the canonical version. It has:
- Cleaner implementation of the same features
- 32 additional commits of product work
- Better test coverage
- No bloat from AppleDouble files

## Action Options

1. **Option A (Recommended)**: Use fork as-is
   - Fork is already ahead with cleaner code
   - All essential changes are present
   - Continue development on fork

2. **Option B**: Selectively copy useful files
   - Telegram plugin (if production-ready)
   - Useful planning docs from doc/plans/
   - Bob-shell debug docs if needed

3. **Option C**: Clarify requirements
   - If specific functionality is missing, identify it
   - Create targeted issues for any gaps

## Conclusion

The original request to "align these two instances" is already satisfied. The fork has all essential changes from the running instance in cleaner form, plus 32 additional commits of new work. No merge action is required.

**Status**: Analysis complete, awaiting user decision on Option A, B, or C.

---
Generated: 2026-05-18
Analysis by: CTO (Bob Shell)
Issue: OCP-66
