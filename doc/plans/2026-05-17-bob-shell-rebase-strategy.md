# Bob Shell Fork Rebase Strategy

**Date:** 2026-05-17  
**Author:** Planning Mode  
**Status:** Draft

## Current Situation

### Fork State
- **13 commits ahead** of upstream (bob-shell feature work)
- **88 commits behind** upstream/master
- Last upstream sync: commit `694ad5b9` (Merge branch 'paperclipai:master' into master)
- Current upstream HEAD: `3e6610fb`
- Current fork HEAD: `457ead54`

### Uncommitted Changes
- `server/src/app.ts` - modified
- `server/src/routes/index.ts` - modified
- `server/src/routes/webhooks/` - untracked directory
- `.bob/` - untracked directory (local tooling, should be in .gitignore)

### Bob Shell Commits (13 total)
1. `bec44e34` - feat: add bob-shell adapter
2. `2bda8ef1` - chore: clean up bob-shell adapter for upstreaming
3. `281ebabe` - chore: remove orphaned bootstrap-prompt test file
4. `8c2cd50a` - fix: add missing @paperclipai/adapter-bob-shell dependency
5. `efe7ffe1` - fix(bob-shell): launch Bob Shell in project cwd
6. `694ad5b9` - **Merge commit** (last upstream sync)
7. `2b6cb19c` - feat(bob-shell): add role-aware mode and tool group selection
8. `ae4940ab` - chore: register bob-shell adapter in pnpm workspace lockfile
9. `c7bea075` - fix(bob-shell): suppress token-by-token progressive log spam
10. `c564f3fc` - fix(bob-shell): only log summary when sentence is complete
11. `6614ce2a` - docs: add Bob Shell setup guide
12. `a13b9703` - docs: fix API key name and remove dead link in setup guide
13. `457ead54` - fix(bob-shell): move coordination messages from stderr to stdout

## Recommended Approach: Interactive Rebase

### Strategy Overview
Use **interactive rebase** to replay bob-shell commits on top of current upstream/master, which provides:
- Clean linear history
- Ability to squash/reorder commits if needed
- Clear conflict resolution points
- Professional PR-ready branch

### Alternative Approaches Considered

#### 1. Merge Strategy (NOT RECOMMENDED)
```bash
git merge upstream/master
```
**Pros:** Simple, preserves all history  
**Cons:** Creates merge commit, messy history, harder to review

#### 2. Rebase with Merge Commit (NOT RECOMMENDED)
```bash
git rebase upstream/master
```
**Cons:** Will try to replay the merge commit `694ad5b9`, causing confusion

#### 3. Interactive Rebase (RECOMMENDED) ✅
```bash
git rebase -i <base-commit>
```
**Pros:** 
- Clean linear history
- Can skip the old merge commit
- Can squash related commits
- Easy to review in PR
- Professional approach

## Step-by-Step Execution Plan

### Phase 1: Preparation
```bash
# 1. Save current work
git stash push -m "WIP: uncommitted server changes"

# 2. Create backup branch (safety net)
git branch backup-before-rebase-$(date +%Y%m%d)

# 3. Verify we're on master
git checkout master

# 4. Fetch latest upstream
git fetch upstream

# 5. Verify commit count
git log --oneline origin/master ^upstream/master | wc -l  # Should show 13
```

### Phase 2: Identify Base Commit
The base commit is the one **before** the first bob-shell commit:
```bash
# Find parent of first bob-shell commit
git log --oneline --all --graph | grep -B1 "feat: add bob-shell adapter"

# Base commit should be the upstream commit before bec44e34
# Likely around commit before the first bob-shell work
```

### Phase 3: Interactive Rebase
```bash
# Start interactive rebase from base commit
# We want to replay commits AFTER the old merge commit 694ad5b9
git rebase -i 694ad5b9

# In the editor, you'll see commits 7-13 from our list
# Keep them as 'pick' or consider squashing related fixes:
# pick 2b6cb19c feat(bob-shell): add role-aware mode and tool group selection
# pick ae4940ab chore: register bob-shell adapter in pnpm workspace lockfile
# fixup c7bea075 fix(bob-shell): suppress token-by-token progressive log spam
# fixup c564f3fc fix(bob-shell): only log summary when sentence is complete
# pick 6614ce2a docs: add Bob Shell setup guide
# fixup a13b9703 docs: fix API key name and remove dead link in setup guide
# fixup 457ead54 fix(bob-shell): move coordination messages from stderr to stdout
```

**Alternative: Rebase all commits excluding merge**
```bash
# Get the commit before first bob-shell commit
BASE=$(git merge-base upstream/master HEAD~13)

# Rebase onto upstream/master
git rebase -i --onto upstream/master $BASE
```

### Phase 4: Conflict Resolution
During rebase, conflicts may occur in:
- `packages/adapters/` - if adapter structure changed
- `server/src/` - if server initialization changed
- `pnpm-lock.yaml` - almost certain to conflict
- Documentation files

**For each conflict:**
```bash
# 1. Check conflict
git status

# 2. Resolve in editor
# Keep bob-shell changes, integrate with upstream changes

# 3. Stage resolved files
git add <resolved-files>

# 4. Continue rebase
git rebase --continue

# If stuck, can skip or abort:
# git rebase --skip
# git rebase --abort
```

### Phase 5: Verification
```bash
# 1. Check commit history is clean
git log --oneline --graph -20

# 2. Verify bob-shell files exist
ls -la packages/adapters/adapter-bob-shell/

# 3. Run type check
pnpm -r typecheck

# 4. Run tests
pnpm test

# 5. Build
pnpm build
```

### Phase 6: Create Feature Branch & PR
```bash
# 1. Create feature branch from rebased master
git checkout -b feat/bob-shell-adapter

# 2. Restore uncommitted work if needed
git stash pop

# 3. Commit uncommitted changes if they're part of bob-shell
git add server/src/app.ts server/src/routes/index.ts
git commit -m "feat(bob-shell): integrate bob-shell routes"

# 4. Push feature branch
git push origin feat/bob-shell-adapter

# 5. Create PR
gh pr create --base master --head feat/bob-shell-adapter \
  --title "feat: Add Bob Shell adapter integration" \
  --body "See doc/plans/2026-05-17-bob-shell-rebase-strategy.md"
```

## Commit Squashing Recommendations

### Option A: Keep Granular History (Easier Review)
- Keep all commits separate
- Shows development progression
- Easier to review individual changes

### Option B: Squash Related Commits (Cleaner)
Suggested squash groups:
1. **Core adapter** (commits 1-5): Initial implementation + fixes
2. **Role-aware features** (commits 7-8): Feature + lockfile update
3. **Logging improvements** (commits 9-10): Progressive log fixes
4. **Documentation** (commits 11-13): Setup guide + fixes

## Risk Mitigation

### Backup Strategy
- Backup branch created before any operations
- Can always return to original state: `git reset --hard backup-before-rebase-<date>`

### Conflict Complexity
- **Low risk:** Documentation files
- **Medium risk:** Adapter code (isolated in packages/adapters/)
- **High risk:** Server integration points, lockfile

### Rollback Plan
```bash
# If rebase goes wrong:
git rebase --abort

# If already completed but broken:
git reset --hard backup-before-rebase-<date>
git push origin master --force-with-lease
```

## Expected Conflicts

### High Probability
1. **pnpm-lock.yaml** - Guaranteed conflict due to 88 commits of dependency changes
   - Resolution: Accept upstream version, then run `pnpm install`

2. **packages/adapters/package.json** - If adapter list changed
   - Resolution: Merge both changes

### Medium Probability
3. **server/src/app.ts** - If server initialization changed
4. **server/src/routes/index.ts** - If route registration changed

### Low Probability
5. **Documentation** - If docs structure changed
6. **TypeScript configs** - If build setup changed

## Post-Rebase Checklist

- [ ] All commits rebased successfully
- [ ] No merge commits in history
- [ ] `pnpm install` runs successfully
- [ ] `pnpm -r typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] Bob Shell adapter files present and correct
- [ ] Documentation updated
- [ ] Uncommitted changes addressed
- [ ] Feature branch created
- [ ] PR created with proper description

## Timeline Estimate

- **Preparation:** 5 minutes
- **Rebase execution:** 15-30 minutes (depending on conflicts)
- **Conflict resolution:** 30-60 minutes (if complex)
- **Testing:** 15-20 minutes
- **PR creation:** 10 minutes

**Total:** 1.5 - 2.5 hours

## Success Criteria

1. ✅ Clean linear history on top of upstream/master
2. ✅ All bob-shell functionality preserved
3. ✅ No merge commits (except intentional feature merges)
4. ✅ All tests pass
5. ✅ Build succeeds
6. ✅ PR ready for review

## Notes

- The `.bob/` directory should be added to `.gitignore` if it's local tooling
- Consider whether `server/src/routes/webhooks/` is part of bob-shell or separate work
- May want to split uncommitted changes into separate PR if unrelated to bob-shell
