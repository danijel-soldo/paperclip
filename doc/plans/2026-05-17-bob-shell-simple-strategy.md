# Bob Shell Integration - Simple Copy Strategy

**Date:** 2026-05-17  
**Author:** Planning Mode  
**Status:** Alternative Approach - RECOMMENDED FOR SIMPLICITY

## Overview

Instead of complex rebasing with 88 commits of conflicts, use a **clean slate approach**:
1. Save bob-shell changes to a separate directory
2. Fresh clone of upstream/master
3. Manually apply the changes
4. Test and commit cleanly

## Why This Approach?

### Advantages ✅
- **No merge conflicts** - Start fresh from upstream
- **Simpler** - No git rebase complexity
- **Faster** - 30-45 minutes vs 1.5-2.5 hours
- **Cleaner history** - Single clean commit or logical commit series
- **Less risky** - No chance of breaking git history
- **Easier to verify** - Clear before/after comparison

### Disadvantages ⚠️
- Loses individual commit history (but we can recreate logical commits)
- Need to manually identify all changed files

## Step-by-Step Execution

### Phase 1: Identify and Save Bob Shell Changes

```bash
# 1. List all bob-shell related files
cd /home/vpcuser/upstream-paperclip/paperclip

# Find bob-shell adapter files
find packages/adapters -name "*bob-shell*" -o -path "*/adapter-bob-shell/*"

# Find documentation
find doc -name "*bob*" -o -name "*Bob*"

# Check server integration
git diff HEAD server/src/app.ts server/src/routes/index.ts

# 2. Create backup directory
mkdir -p /tmp/bob-shell-backup
cd /tmp/bob-shell-backup

# 3. Copy bob-shell adapter package
cp -r /home/vpcuser/upstream-paperclip/paperclip/packages/adapters/adapter-bob-shell ./adapter-bob-shell

# 4. Copy documentation
mkdir -p docs
cp /home/vpcuser/upstream-paperclip/paperclip/doc/*bob* ./docs/ 2>/dev/null || true
cp /home/vpcuser/upstream-paperclip/paperclip/BOB_SHELL_SETUP.md ./docs/ 2>/dev/null || true

# 5. Save uncommitted server changes
mkdir -p server-changes
cd /home/vpcuser/upstream-paperclip/paperclip
git diff server/src/app.ts > /tmp/bob-shell-backup/server-changes/app.ts.patch
git diff server/src/routes/index.ts > /tmp/bob-shell-backup/server-changes/index.ts.patch

# 6. Copy webhooks if it's part of bob-shell
if [ -d "server/src/routes/webhooks" ]; then
  cp -r server/src/routes/webhooks /tmp/bob-shell-backup/server-changes/
fi

# 7. Save package.json changes
git diff packages/adapters/package.json > /tmp/bob-shell-backup/adapters-package.json.patch 2>/dev/null || true
git diff server/package.json > /tmp/bob-shell-backup/server-package.json.patch 2>/dev/null || true

# 8. Create a summary file
cat > /tmp/bob-shell-backup/CHANGES.md << 'EOF'
# Bob Shell Changes Summary

## Files Added/Modified

### Adapter Package
- packages/adapters/adapter-bob-shell/ (entire directory)

### Documentation
- BOB_SHELL_SETUP.md
- doc/*bob* files

### Server Integration
- server/src/app.ts (modifications)
- server/src/routes/index.ts (modifications)
- server/src/routes/webhooks/ (if applicable)

### Package Dependencies
- packages/adapters/package.json (bob-shell entry)
- server/package.json (bob-shell dependency)
- pnpm-lock.yaml (will regenerate)

## Key Changes

1. **Adapter Implementation**: Full bob-shell adapter in packages/adapters/
2. **Server Registration**: Bob-shell registered in server startup
3. **Route Integration**: Bob-shell routes added to server
4. **Documentation**: Setup guide and usage docs

## Testing Checklist
- [ ] pnpm install
- [ ] pnpm -r typecheck
- [ ] pnpm test
- [ ] pnpm build
- [ ] Manual test: bob-shell adapter loads
- [ ] Manual test: bob-shell routes respond
EOF

echo "Backup created in /tmp/bob-shell-backup"
ls -la /tmp/bob-shell-backup
```

### Phase 2: Fresh Clone of Upstream

```bash
# 1. Navigate to parent directory
cd /home/vpcuser/upstream-paperclip

# 2. Clone fresh upstream (new directory)
git clone https://github.com/paperclipai/paperclip.git paperclip-fresh
cd paperclip-fresh

# 3. Verify it's latest
git log --oneline -5

# 4. Add your fork as remote (for later push)
git remote add fork git@github.com:danijel-soldo/paperclip.git

# 5. Create feature branch
git checkout -b feat/bob-shell-adapter
```

### Phase 3: Apply Bob Shell Changes

```bash
cd /home/vpcuser/upstream-paperclip/paperclip-fresh

# 1. Copy adapter package
cp -r /tmp/bob-shell-backup/adapter-bob-shell packages/adapters/

# 2. Copy documentation
cp /tmp/bob-shell-backup/docs/* . 2>/dev/null || true

# 3. Apply server patches (review first!)
# Option A: Apply patches automatically
cd server/src
patch -p3 < /tmp/bob-shell-backup/server-changes/app.ts.patch
patch -p3 < /tmp/bob-shell-backup/server-changes/index.ts.patch

# Option B: Apply manually (RECOMMENDED - more control)
# Open files side-by-side and copy changes:
# - server/src/app.ts: Add bob-shell import and registration
# - server/src/routes/index.ts: Add bob-shell routes

# 4. Copy webhooks if applicable
if [ -d "/tmp/bob-shell-backup/server-changes/webhooks" ]; then
  cp -r /tmp/bob-shell-backup/server-changes/webhooks server/src/routes/
fi

# 5. Update package.json files
# Edit packages/adapters/package.json - add bob-shell entry
# Edit server/package.json - add bob-shell dependency

# 6. Install dependencies
cd /home/vpcuser/upstream-paperclip/paperclip-fresh
pnpm install
```

### Phase 4: Verify and Test

```bash
cd /home/vpcuser/upstream-paperclip/paperclip-fresh

# 1. Type check
pnpm -r typecheck

# 2. Run tests
pnpm test

# 3. Build
pnpm build

# 4. Manual verification
# - Check adapter loads: ls packages/adapters/adapter-bob-shell
# - Check server integration: grep -r "bob-shell" server/src
# - Check docs: ls -la *bob* doc/*bob*

# 5. Compare with backup to ensure nothing missed
diff -r /tmp/bob-shell-backup/adapter-bob-shell packages/adapters/adapter-bob-shell
```

### Phase 5: Commit and Push

```bash
cd /home/vpcuser/upstream-paperclip/paperclip-fresh

# Option A: Single commit (simplest)
git add .
git commit -m "feat: add Bob Shell adapter integration

- Add bob-shell adapter package
- Integrate bob-shell routes in server
- Add Bob Shell setup documentation
- Update dependencies for bob-shell support"

# Option B: Logical commits (better for review)
# Commit 1: Adapter package
git add packages/adapters/adapter-bob-shell
git commit -m "feat(adapters): add bob-shell adapter package"

# Commit 2: Server integration
git add server/src/app.ts server/src/routes/index.ts server/src/routes/webhooks
git add server/package.json packages/adapters/package.json
git commit -m "feat(server): integrate bob-shell adapter routes"

# Commit 3: Documentation
git add BOB_SHELL_SETUP.md doc/*bob*
git commit -m "docs: add Bob Shell setup guide and documentation"

# Commit 4: Dependencies
git add pnpm-lock.yaml
git commit -m "chore: update lockfile for bob-shell dependencies"

# Push to your fork
git push fork feat/bob-shell-adapter

# Create PR
gh pr create --repo paperclipai/paperclip \
  --base master \
  --head danijel-soldo:feat/bob-shell-adapter \
  --title "feat: Add Bob Shell adapter integration" \
  --body "Adds Bob Shell adapter with server integration and documentation.

## Changes
- New bob-shell adapter package
- Server route integration
- Setup documentation
- Dependency updates

## Testing
- [x] Type check passes
- [x] Tests pass
- [x] Build succeeds
- [x] Manual verification complete"
```

### Phase 6: Cleanup (Optional)

```bash
# Keep old repo as backup for a while
mv /home/vpcuser/upstream-paperclip/paperclip /home/vpcuser/upstream-paperclip/paperclip-old-backup

# Rename fresh clone to main location
mv /home/vpcuser/upstream-paperclip/paperclip-fresh /home/vpcuser/upstream-paperclip/paperclip

# Later, after PR is merged, can delete backup
# rm -rf /home/vpcuser/upstream-paperclip/paperclip-old-backup
# rm -rf /tmp/bob-shell-backup
```

## File Checklist

### Files to Copy
- [ ] `packages/adapters/adapter-bob-shell/` (entire directory)
- [ ] `BOB_SHELL_SETUP.md`
- [ ] `doc/` bob-shell related docs
- [ ] `server/src/app.ts` (changes only)
- [ ] `server/src/routes/index.ts` (changes only)
- [ ] `server/src/routes/webhooks/` (if bob-shell related)
- [ ] `.bob/custom_modes.yaml` (if needed for adapter)

### Files to Update
- [ ] `packages/adapters/package.json` (add bob-shell)
- [ ] `server/package.json` (add bob-shell dependency)
- [ ] `pnpm-lock.yaml` (regenerate via pnpm install)

### Files to Ignore
- [ ] `.bob/` directory (local tooling, add to .gitignore)
- [ ] Any unrelated uncommitted changes

## Comparison: Rebase vs Copy Strategy

| Aspect | Rebase Strategy | Copy Strategy |
|--------|----------------|---------------|
| **Time** | 1.5-2.5 hours | 30-45 minutes |
| **Complexity** | High (git expertise) | Low (file operations) |
| **Risk** | Medium (can break history) | Low (fresh start) |
| **Conflicts** | Many (88 commits) | None |
| **History** | Preserves commits | Clean new commits |
| **Verification** | Complex | Simple comparison |
| **Rollback** | Need backup branch | Keep old directory |

## When to Use Each Strategy

### Use Copy Strategy (This One) When:
- ✅ Large number of upstream commits (88 in this case)
- ✅ Want clean, simple history
- ✅ Changes are isolated (bob-shell is self-contained)
- ✅ Time is limited
- ✅ Want to avoid git complexity

### Use Rebase Strategy When:
- Individual commit history is important
- Few upstream commits to catch up
- Changes are intertwined with upstream changes
- Need to preserve commit authorship/dates

## Estimated Timeline

- **Phase 1** (Backup): 10 minutes
- **Phase 2** (Fresh clone): 5 minutes
- **Phase 3** (Apply changes): 15-20 minutes
- **Phase 4** (Test): 15-20 minutes
- **Phase 5** (Commit/Push): 5-10 minutes

**Total: 50-65 minutes**

## Success Criteria

- [ ] All bob-shell files copied to fresh clone
- [ ] Server integration working
- [ ] Documentation present
- [ ] `pnpm install` succeeds
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] Feature branch pushed to fork
- [ ] PR created

## Notes

- This approach is **much simpler** than rebasing 88 commits
- Results in **cleaner git history** for PR review
- **Lower risk** - can't break existing git history
- Can still create **logical commits** for better review
- Old repo kept as backup until PR is merged
