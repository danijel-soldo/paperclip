# Ngrok URL Issue Analysis

**Date:** 2026-05-11  
**Issue:** Agents attempting to use ngrok URLs instead of localhost for Paperclip API

## Root Cause

The Paperclip server automatically discovers and includes ALL network interface addresses as API URL candidates via `collectReachableInterfaceHosts()` in `server/src/runtime-api.ts`.

### Code Flow

1. **Server startup** (`server/src/index.ts:641`):
   ```typescript
   const runtimeApiCandidates = buildRuntimeApiCandidateUrls({
     preferredApiUrl: configuredApiUrl,
     authPublicBaseUrl: config.authPublicBaseUrl ?? null,
     allowedHostnames: config.allowedHostnames,
     bindHost: runtimeListenHost,
     port: listenPort,
   });
   process.env.PAPERCLIP_RUNTIME_API_CANDIDATES_JSON = JSON.stringify(runtimeApiCandidates);
   ```

2. **Candidate URL building** (`server/src/runtime-api.ts:107-168`):
   ```typescript
   export function buildRuntimeApiCandidateUrls(input: {...}): string[] {
     // ... adds preferredApiUrl, authPublicBaseUrl, allowedHostnames, bindHost ...
     
     // THIS IS THE PROBLEM:
     for (const host of collectReachableInterfaceHosts({ networkInterfacesMap: input.networkInterfacesMap })) {
       const formattedHost = host.includes(":") && !host.startsWith("[") && !host.endsWith("]") ? `[${host}]` : host;
       candidates.add(`${protocol}//${formattedHost}${port}`);
     }
     
     return Array.from(candidates);
   }
   ```

3. **Interface scanning** (`server/src/runtime-api.ts:79-106`):
   ```typescript
   export function collectReachableInterfaceHosts(input: {...}): string[] {
     const interfaces = input.networkInterfacesMap ?? os.networkInterfaces();
     // Scans ALL interfaces, including ngrok tunnels
     for (const entries of Object.values(interfaces)) {
       for (const entry of entries ?? []) {
         if (entry.internal) continue;
         // Filters out loopback, wildcard, link-local
         // BUT INCLUDES ngrok tunnel interfaces
       }
     }
   }
   ```

4. **Bob-shell adapter** (`packages/adapters/bob-shell/src/server/workspace.ts:184`):
   ```typescript
   const apiUrl = env.PAPERCLIP_API_URL || "http://localhost:3100";
   ```
   - Defaults to localhost ✓
   - BUT inherits `PAPERCLIP_API_URL` from parent process if set

## Why Ngrok URLs Appear

When ngrok is running, it creates network interfaces that:
- Are NOT internal (not loopback)
- Are NOT link-local
- Pass all filters in `collectReachableInterfaceHosts()`
- Get added to `PAPERCLIP_RUNTIME_API_CANDIDATES_JSON`

These candidates are then:
1. Set in the server's environment
2. Inherited by agent processes
3. May be used by agents if `PAPERCLIP_API_URL` is not explicitly set to localhost

## Current Behavior

**Bob-shell adapter defaults:**
- ✅ Correctly defaults to `http://localhost:3100`
- ✅ Only uses ngrok URL if explicitly set via `PAPERCLIP_API_URL` env var

**Server behavior:**
- ❌ Automatically discovers and includes ngrok tunnel IPs in candidate list
- ❌ These candidates propagate to agent environments
- ❌ May confuse agents or cause connection issues

## Solutions

### Option 1: Filter Tunnel Interfaces (Recommended)

Modify `collectReachableInterfaceHosts()` to detect and exclude tunnel interfaces:

```typescript
function isTunnelInterface(entry: os.NetworkInterfaceInfo): boolean {
  // Detect common tunnel patterns
  const address = entry.address.toLowerCase();
  
  // ngrok typically uses specific IP ranges or interface names
  // Check interface name patterns (would need to pass interface name)
  // Or check for specific IP ranges used by tunneling services
  
  return false; // Implement detection logic
}

export function collectReachableInterfaceHosts(input: {...}): string[] {
  // ... existing code ...
  for (const entry of entries ?? []) {
    if (entry.internal) continue;
    if (isTunnelInterface(entry)) continue; // ADD THIS
    // ... rest of logic ...
  }
}
```

### Option 2: Prioritize Localhost in Candidates

Ensure localhost always appears first in the candidate list:

```typescript
export function buildRuntimeApiCandidateUrls(input: {...}): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  
  // ALWAYS add localhost first
  pushCandidate(candidates, seen, formatOrigin(protocol, "localhost", input.port));
  
  // Then add other candidates
  pushCandidate(candidates, seen, input.preferredApiUrl);
  // ... rest of logic ...
}
```

### Option 3: Explicit Opt-in for Network Discovery

Add configuration to disable automatic network interface discovery:

```typescript
// In config
interface ServerConfig {
  // ... existing fields ...
  discoverNetworkInterfaces?: boolean; // Default: false
}

// In buildRuntimeApiCandidateUrls
if (input.discoverNetworkInterfaces) {
  for (const host of collectReachableInterfaceHosts(...)) {
    // ... add to candidates ...
  }
}
```

### Option 4: Bob-shell Adapter Filtering

Make bob-shell adapter more selective about which candidate URLs to use:

```typescript
// In packages/adapters/bob-shell/src/server/workspace.ts
function selectBestApiUrl(env: Record<string, string>): string {
  const explicit = env.PAPERCLIP_API_URL?.trim();
  if (explicit) return explicit;
  
  // Parse candidates and prefer localhost
  const candidatesJson = env.PAPERCLIP_RUNTIME_API_CANDIDATES_JSON;
  if (candidatesJson) {
    try {
      const candidates = JSON.parse(candidatesJson) as string[];
      const localhost = candidates.find(url => 
        url.includes('localhost') || url.includes('127.0.0.1')
      );
      if (localhost) return localhost;
    } catch {}
  }
  
  return "http://localhost:3100";
}
```

## Recommendation

**Implement Option 1 + Option 2:**

1. **Filter tunnel interfaces** to prevent them from being discovered
2. **Prioritize localhost** in the candidate list to ensure it's always first choice
3. **Document** the behavior in `docs/deploy/environment-variables.md`

This provides defense-in-depth:
- Prevents tunnel URLs from being discovered (Option 1)
- Ensures localhost is preferred even if tunnels slip through (Option 2)
- Maintains backward compatibility
- No breaking changes to existing deployments

## Testing

After implementing fixes:

1. Start ngrok tunnel
2. Start Paperclip server
3. Check `PAPERCLIP_RUNTIME_API_CANDIDATES_JSON` - should NOT contain ngrok URLs
4. Create agent and verify it uses localhost
5. Test with explicit `PAPERCLIP_API_URL` override - should still work

## Related Files

- `server/src/runtime-api.ts` - URL candidate building
- `server/src/index.ts` - Server startup and env setup
- `packages/adapters/bob-shell/src/server/workspace.ts` - Bob-shell API URL selection
- `packages/adapter-utils/src/server-utils.ts` - Paperclip env variable setup
- `docs/deploy/environment-variables.md` - Documentation
