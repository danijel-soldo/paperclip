# Bob Shell - Complete File Change List

**Date:** 2026-05-17  
**Generated from:** `git diff --name-only upstream/master...HEAD` + `git status`

## Summary

- **Total committed files:** 33 files
- **Uncommitted changes:** 2 files
- **Untracked directories:** 3 directories

---

## 1. Committed Changes (33 files)

### Documentation (1 file)
```
BOB_SHELL_SETUP.md
```

### Bob Shell Adapter Package (24 files)
```
packages/adapters/bob-shell/README.md
packages/adapters/bob-shell/package.json
packages/adapters/bob-shell/tsconfig.json
packages/adapters/bob-shell/vitest.config.ts

packages/adapters/bob-shell/src/index.ts
packages/adapters/bob-shell/src/cli/index.ts

packages/adapters/bob-shell/src/server/index.ts
packages/adapters/bob-shell/src/server/cache-utils.ts
packages/adapters/bob-shell/src/server/error-detection.ts
packages/adapters/bob-shell/src/server/execute.ts
packages/adapters/bob-shell/src/server/metadata-extraction.ts
packages/adapters/bob-shell/src/server/parse-json-stream.ts
packages/adapters/bob-shell/src/server/parse-stdout.ts
packages/adapters/bob-shell/src/server/prompt-cache.ts
packages/adapters/bob-shell/src/server/skills.ts
packages/adapters/bob-shell/src/server/test.ts
packages/adapters/bob-shell/src/server/workspace.ts

packages/adapters/bob-shell/src/server/__tests__/cache-utils.test.ts
packages/adapters/bob-shell/src/server/__tests__/error-classification.test.ts
packages/adapters/bob-shell/src/server/__tests__/parse-json-stream.test.ts
packages/adapters/bob-shell/src/server/error-detection.test.ts
packages/adapters/bob-shell/src/server/metadata-extraction.test.ts
packages/adapters/bob-shell/src/server/prompt-cache.test.ts

packages/adapters/bob-shell/src/ui/index.tsx
```

### Server Integration (4 files)
```
server/package.json
server/src/adapters/builtin-adapter-types.ts
server/src/adapters/registry.ts
pnpm-lock.yaml
```

### UI Integration (4 files)
```
ui/src/adapters/bob-shell/._config-fields.tsx
ui/src/adapters/bob-shell/._index.ts
ui/src/adapters/bob-shell/config-fields.tsx
ui/src/adapters/bob-shell/index.ts
ui/src/adapters/registry.ts
```

---

## 2. Uncommitted Changes (2 files)

### Modified Files
```
server/src/app.ts          (M - modified)
server/src/routes/index.ts (M - modified)
```

**Purpose:** Likely server startup and route registration for bob-shell

---

## 3. Untracked Files/Directories (3 items)

### Local Tooling (should be ignored)
```
.bob/                      (?? - untracked directory)
```
**Action:** Add to `.gitignore` - this is local development tooling

### Planning Documents (just created)
```
doc/plans/2026-05-17-bob-shell-rebase-strategy.md
doc/plans/2026-05-17-bob-shell-simple-strategy.md
```
**Action:** Can commit these as planning documentation

### Webhooks Directory
```
server/src/routes/webhooks/ (?? - untracked directory)
```
**Action:** Determine if this is part of bob-shell or separate work

---

## Files to Copy for Simple Strategy

### Priority 1: Core Adapter (Required)
```bash
# Entire adapter package
packages/adapters/bob-shell/
```

### Priority 2: Server Integration (Required)
```bash
# Modified files (need to extract changes)
server/src/app.ts
server/src/routes/index.ts
server/src/adapters/builtin-adapter-types.ts
server/src/adapters/registry.ts

# Package dependencies
server/package.json
```

### Priority 3: UI Integration (Required)
```bash
# UI adapter configuration
ui/src/adapters/bob-shell/
ui/src/adapters/registry.ts
```

### Priority 4: Documentation (Required)
```bash
BOB_SHELL_SETUP.md
```

### Priority 5: Dependencies (Will Regenerate)
```bash
pnpm-lock.yaml  # Don't copy - will regenerate with pnpm install
```

### Optional: Planning Docs
```bash
doc/plans/2026-05-17-bob-shell-rebase-strategy.md
doc/plans/2026-05-17-bob-shell-simple-strategy.md
doc/plans/2026-05-17-bob-shell-files-changed.md
```

### Ignore: Local Tooling
```bash
.bob/  # Add to .gitignore
```

### Investigate: Webhooks
```bash
server/src/routes/webhooks/  # Determine if bob-shell related
```

---

## Backup Commands for Simple Strategy

```bash
# Create backup directory
mkdir -p /tmp/bob-shell-backup

# Copy adapter package
cp -r packages/adapters/bob-shell /tmp/bob-shell-backup/

# Copy documentation
cp BOB_SHELL_SETUP.md /tmp/bob-shell-backup/

# Save server changes as patches
git diff server/src/app.ts > /tmp/bob-shell-backup/app.ts.patch
git diff server/src/routes/index.ts > /tmp/bob-shell-backup/index.ts.patch

# Copy committed server files
mkdir -p /tmp/bob-shell-backup/server-integration
cp server/src/adapters/builtin-adapter-types.ts /tmp/bob-shell-backup/server-integration/
cp server/src/adapters/registry.ts /tmp/bob-shell-backup/server-integration/
cp server/package.json /tmp/bob-shell-backup/server-integration/

# Copy UI integration
mkdir -p /tmp/bob-shell-backup/ui-integration
cp -r ui/src/adapters/bob-shell /tmp/bob-shell-backup/ui-integration/
cp ui/src/adapters/registry.ts /tmp/bob-shell-backup/ui-integration/

# Copy webhooks if bob-shell related
if [ -d "server/src/routes/webhooks" ]; then
  cp -r server/src/routes/webhooks /tmp/bob-shell-backup/
fi

# Copy planning docs (optional)
mkdir -p /tmp/bob-shell-backup/docs
cp doc/plans/2026-05-17-*.md /tmp/bob-shell-backup/docs/

# Create inventory
ls -laR /tmp/bob-shell-backup > /tmp/bob-shell-backup/INVENTORY.txt
```

---

## File Categories Summary

| Category | Count | Action |
|----------|-------|--------|
| Adapter Package | 24 files | Copy entire directory |
| Server Integration | 4 committed + 2 uncommitted | Copy + apply patches |
| UI Integration | 4 files | Copy directory |
| Documentation | 1 file | Copy |
| Dependencies | 1 file | Regenerate (don't copy) |
| Planning Docs | 3 files | Optional |
| Local Tooling | 1 directory | Ignore (add to .gitignore) |
| Webhooks | 1 directory | Investigate |

**Total files to handle:** ~35 files + 1 directory to investigate
