# Telegram Plugin Integration Plan

## Current Status

The telegram plugin has been copied from `/home/vpcuser/paperclip-plugin-telegram` to `/home/vpcuser/paperclip/packages/plugins/plugin-telegram`.

## Issues Identified

### 1. Package.json Issues

**Current problems:**
- Circular self-dependency: `"paperclip-plugin-telegram": "^0.3.0"` in dependencies
- Uses `peerDependencies` instead of workspace dependencies
- Missing `prebuild` script that ensures plugin SDK is built first
- Not marked as `private: true` (should be for monorepo packages)
- Package name doesn't follow monorepo convention (`@paperclipai/plugin-telegram`)

**Required changes:**
```json
{
  "name": "@paperclipai/plugin-telegram",
  "version": "0.3.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "paperclipPlugin": {
    "manifest": "./dist/manifest.js",
    "worker": "./dist/worker.js"
  },
  "scripts": {
    "prebuild": "node ../../../../scripts/ensure-plugin-build-deps.mjs",
    "build": "tsc",
    "typecheck": "pnpm --filter @paperclipai/plugin-sdk build && tsc --noEmit",
    "clean": "rm -rf dist",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "@paperclipai/plugin-sdk": "workspace:*",
    "@paperclipai/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^24.6.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.0"
  }
}
```

### 2. TypeScript Configuration Issues

**Current problems:**
- Doesn't extend base tsconfig
- Uses `Node16` module resolution (monorepo uses `NodeNext`)
- Missing alignment with monorepo standards

**Required changes:**
```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Workspace Configuration

**Status:** ✅ Already included
The `pnpm-workspace.yaml` already includes `packages/plugins/*`, so the plugin will be automatically included.

### 4. Build Dependencies

The plugin depends on:
- `@paperclipai/plugin-sdk` - Must be built before this plugin
- `@paperclipai/shared` - Shared types and utilities

The `prebuild` script ensures these are built first.

### 5. Source Code Compatibility

**Files to review:**
- `src/manifest.ts` - Uses plugin SDK types ✅
- `src/worker.ts` - Main worker implementation
- `src/constants.ts` - Configuration defaults
- `src/telegram-api.ts` - Telegram Bot API client
- `src/formatters.ts` - Message formatting
- `src/commands.ts` - Bot command handlers
- `src/escalation.ts` - HITL escalation logic
- `src/acp-bridge.ts` - ACP session management
- `src/media-pipeline.ts` - Media processing
- `src/command-registry.ts` - Custom workflow commands
- `src/watch-registry.ts` - Proactive suggestions

**Potential issues:**
- Import paths may need adjustment if SDK structure changed
- API client patterns should match monorepo conventions
- Event subscription patterns should align with current SDK

## Implementation Steps

### Phase 1: Package Configuration (Code Mode)
1. Update `package.json` with correct dependencies and scripts
2. Remove circular self-dependency
3. Add `private: true` flag
4. Update package name to `@paperclipai/plugin-telegram`

### Phase 2: TypeScript Configuration (Code Mode)
1. Update `tsconfig.json` to extend base config
2. Align module resolution with monorepo standards

### Phase 3: Dependency Installation (Code Mode)
1. Run `pnpm install` from repo root
2. Verify workspace links are created correctly
3. Check for dependency conflicts

### Phase 4: Build Verification (Code Mode)
1. Run `pnpm --filter @paperclipai/plugin-telegram typecheck`
2. Fix any import path issues
3. Run `pnpm --filter @paperclipai/plugin-telegram build`
4. Verify dist output is correct

### Phase 5: Testing (Code Mode)
1. Run existing test suite: `pnpm --filter @paperclipai/plugin-telegram test`
2. Fix any test failures related to SDK changes
3. Verify all ~80 tests pass

### Phase 6: Integration Testing (Advanced Mode)
1. Start Paperclip dev server: `pnpm dev`
2. Navigate to Plugin Settings in UI
3. Verify plugin appears in available plugins list
4. Test plugin activation with minimal config
5. Verify worker starts successfully
6. Test basic notification flow

### Phase 7: Documentation Updates (Plan Mode)
1. Update README.md with monorepo-specific instructions
2. Add note about workspace dependencies
3. Update development section for monorepo context
4. Document any breaking changes from standalone version

## Success Criteria

- [ ] Package.json uses workspace dependencies
- [ ] No circular dependencies
- [ ] TypeScript compilation succeeds
- [ ] All tests pass
- [ ] Plugin can be activated in Paperclip UI
- [ ] Worker starts without errors
- [ ] Basic notification flow works
- [ ] Documentation reflects monorepo integration

## Risks and Mitigations

### Risk: SDK API Changes
**Mitigation:** Review SDK changelog and update imports/usage patterns

### Risk: Breaking Changes in Shared Types
**Mitigation:** Run typecheck early and fix type errors incrementally

### Risk: Event System Changes
**Mitigation:** Review event subscription patterns in other plugins

### Risk: Test Environment Differences
**Mitigation:** Update test setup to match monorepo test patterns

## Next Steps

1. Switch to **code mode** to implement Phase 1-6
2. Return to **plan mode** for documentation updates
3. Create PR following `.github/PULL_REQUEST_TEMPLATE.md`

## Notes

- Plugin was originally standalone npm package
- Now integrating as first-party monorepo plugin
- Maintains all features: notifications, commands, escalation, multi-agent, media, workflows, watches
- No feature removal, only integration changes
