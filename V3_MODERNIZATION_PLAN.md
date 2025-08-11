# V3 Modernization Plan: Bash to TypeScript Migration for GitHub Actions
## Executive Summary

This plan addresses the critical misunderstanding in V2 about GitHub Actions execution model and provides a practical, maintainability-focused approach to modernizing 4 bash-based actions totaling ~1,967 lines of shell script.

## 1. Architecture Decision: JavaScript Actions with TypeScript

### Chosen Approach: JavaScript Actions
- **Why**: Direct Node.js execution, full TypeScript benefits, proper dependency management
- **Runtime**: Node.js 20 (latest GitHub Actions runtime)
- **Bundler**: @vercel/ncc (GitHub's recommended bundler, zero-config)
- **Structure**: Shared utilities package + individual action packages

### Why NOT Composite Actions
- Composite actions would still execute bash scripts, defeating the maintainability goal
- Cannot share TypeScript code effectively between composite actions
- Limited debugging capabilities compared to JavaScript actions

## 2. Common Patterns Analysis

### Identified Reusable Components (Lines of Code Saved)

1. **Platform Detection & Validation** (~150 lines)
   - OS/Architecture detection
   - GitHub Actions runner validation
   - Cross-platform path handling

2. **Network Operations** (~200 lines)
   - Retry logic with exponential backoff
   - Download verification
   - API calls with timeout handling

3. **OAuth/Authentication** (~120 lines)
   - Token acquisition
   - Secret masking
   - Token refresh logic

4. **Process Management** (~180 lines)
   - PID tracking
   - Health checks with retry
   - Graceful shutdown patterns

5. **GitHub Actions Helpers** (~100 lines)
   - Output setting with masking
   - Group logging
   - Step summaries
   - Cache key generation

6. **Error Handling & Logging** (~150 lines)
   - Structured error reporting
   - Debug mode handling
   - Contextual error messages

**Total Reusable**: ~900 lines (45% of codebase)

## 3. Repository Structure

```
actions/
├── packages/
│   ├── shared/                    # Shared utilities
│   │   ├── src/
│   │   │   ├── platform.ts       # Platform detection
│   │   │   ├── network.ts        # Retry & download logic
│   │   │   ├── github-actions.ts # GHA helpers
│   │   │   ├── process.ts        # Process management
│   │   │   ├── oauth.ts          # OAuth utilities
│   │   │   └── logger.ts         # Structured logging
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── setup-ftl/                 # Action 1
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point
│   │   │   ├── installer.ts      # FTL installation logic
│   │   │   ├── dependencies.ts   # Spin/wkg installation
│   │   │   └── cache.ts          # Caching logic
│   │   ├── action.yml
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── ftl-eng-deploy/           # Action 2
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── deploy.ts
│   │   │   └── auth.ts
│   │   └── ...
│   │
│   ├── start-ftl-server/         # Action 3
│   │   └── ...
│   │
│   └── stop-ftl-server/          # Action 4
│       └── ...
│
├── scripts/
│   ├── build.ts                  # Build all actions
│   ├── test-local.ts             # Local testing
│   └── release.ts                # Release automation
│
├── .github/
│   └── workflows/
│       ├── test.yml              # Test all actions
│       └── release.yml           # Auto-release on tag
│
├── package.json                  # Root package (workspace)
├── tsconfig.base.json           # Shared TS config
└── pnpm-workspace.yaml          # PNPM workspace config
```

## 4. Implementation Strategy

### Phase 1: Foundation (Week 1)
1. **Setup repository structure**
   - Initialize PNPM workspace
   - Configure TypeScript with strict mode
   - Setup build tooling with @vercel/ncc

2. **Create shared utilities package**
   - Port platform detection logic
   - Implement network retry utilities
   - Create GitHub Actions helpers
   - Add structured logging

3. **Testing infrastructure**
   - Jest for unit tests
   - Mock GitHub Actions environment
   - Integration test harness

### Phase 2: High-Value Conversions (Week 2-3)

#### Priority 1: setup-ftl (898 lines → ~300 lines TS)
**Why first**: Most complex, most reused, highest maintenance burden
- Complex platform detection
- Network reliability issues
- Dependency management pain points

#### Priority 2: ftl-eng-deploy (384 lines → ~150 lines TS)
**Why second**: OAuth complexity, security concerns
- OAuth token management
- Secret handling improvements
- Better error messages for auth failures

### Phase 3: Complete Migration (Week 4)

#### Priority 3: start-ftl-server (570 lines → ~200 lines TS)
- Process management complexity
- Health check improvements

#### Priority 4: stop-ftl-server (115 lines → ~50 lines TS)
- Simple, low priority
- Mostly reuses process management utilities

### Phase 4: Polish & Release (Week 5)
- Documentation updates
- Migration guide for users
- Performance benchmarking
- Security audit

## 5. Technical Implementation Details

### Build Configuration

**package.json (root)**
```json
{
  "name": "@fastertools/actions",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "release": "node scripts/release.js"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.0",
    "typescript": "^5.3.0",
    "turbo": "^1.11.0",
    "@types/node": "^20.0.0"
  }
}
```

**Build Output Structure**
Each action will have:
```
actions/setup-ftl/
├── action.yml          # Points to dist/index.js
├── dist/
│   ├── index.js       # Bundled output (checked in)
│   └── index.js.map   # Source map for debugging
└── src/               # Source code (TypeScript)
```

### Key Code Patterns

**Retry Logic (network.ts)**
```typescript
export async function downloadWithRetry(
  url: string,
  options: DownloadOptions = {}
): Promise<Buffer> {
  const { maxRetries = 3, backoffMs = 5000 } = options;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      core.info(`Download attempt ${attempt}/${maxRetries}: ${url}`);
      return await download(url);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = backoffMs * Math.pow(2, attempt - 1);
      core.warning(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw new Error('Unreachable');
}
```

**Platform Detection (platform.ts)**
```typescript
export interface Platform {
  os: 'linux' | 'darwin' | 'win32';
  arch: 'x64' | 'arm64';
  runner: string;
}

export function detectPlatform(): Platform {
  // Use GitHub Actions context first
  const runner = process.env.RUNNER_OS || '';
  const arch = process.env.RUNNER_ARCH || '';
  
  // Validate and normalize
  const platform = normalizePlatform(runner, arch);
  
  // Verify with Node.js runtime
  validatePlatform(platform);
  
  return platform;
}
```

## 6. Testing Strategy

### Unit Tests
- Each utility function tested in isolation
- Mock external dependencies
- 80% code coverage target

### Integration Tests
```yaml
# .github/workflows/test.yml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest]
    arch: [x64, arm64]
    node: [20]
```

### Local Testing
```bash
# Test action locally without GitHub Actions
pnpm test:local --action setup-ftl --inputs version=latest
```

## 7. Migration Path for Users

### Backward Compatibility
- Keep same input/output interface
- Use same action.yml structure
- Provide migration warnings for deprecated features

### Gradual Rollout
1. Release as `v2-beta` tags first
2. Run both bash and TS versions in parallel for 2 weeks
3. Monitor error rates and performance
4. Full cutover to v2

## 8. Success Metrics

### Maintainability Improvements
- **Code Reduction**: 1,967 lines bash → ~700 lines TypeScript (65% reduction)
- **Type Safety**: 100% typed code vs 0% in bash
- **Test Coverage**: 80% vs ~0% currently
- **Error Messages**: Structured, actionable errors with context

### Performance (Acceptable Trade-offs)
- **Setup Time**: +200-500ms for Node.js startup (acceptable)
- **Bundle Size**: ~2MB per action (includes all dependencies)
- **Caching**: Improved cache key generation saves 30s on cache hits

## 9. Risk Mitigation

### Technical Risks
1. **Node.js version compatibility**
   - Mitigation: Target Node.js 20, test on 16
   - Fallback: Can use node16 runtime if issues

2. **Platform-specific bugs**
   - Mitigation: Extensive matrix testing
   - Fallback: Keep bash scripts for emergency

3. **Bundle size**
   - Mitigation: Use @vercel/ncc tree-shaking
   - Monitor: Alert if dist/ > 5MB

### Rollback Strategy
```yaml
# Users can pin to last bash version
- uses: fastertools/actions/setup-ftl@v1-bash
# Or use new TypeScript version
- uses: fastertools/actions/setup-ftl@v2
```

## 10. Timeline

| Week | Phase | Deliverables | Success Criteria |
|------|-------|--------------|------------------|
| 1 | Foundation | Shared utilities, build system | All utilities have tests |
| 2-3 | High-Value | setup-ftl, ftl-eng-deploy | Both actions passing all tests |
| 4 | Complete | start/stop-ftl-server | All actions migrated |
| 5 | Polish | Docs, release process | Beta release ready |
| 6 | Monitor | Beta testing | <1% error rate increase |
| 7 | Release | v2.0.0 | Full cutover |

## 11. Specific Answers to Requirements

### Q: JavaScript actions or composite actions?
**A: JavaScript actions** - Enables true code reuse and debugging

### Q: What bundler makes sense?
**A: @vercel/ncc** - GitHub's recommendation, zero config, tree-shaking

### Q: Which parts should stay as .sh files?
**A: None** - Full TypeScript for maximum maintainability

### Q: How to structure shared code?
**A: PNPM workspace** with shared package, imported by each action

### Q: Migration order?
**A: setup-ftl → ftl-eng-deploy → start-ftl-server → stop-ftl-server**
Based on complexity and maintenance pain points

## 12. Example: setup-ftl Migration

### Before (Bash - 898 lines)
```bash
# Complex platform detection
detect_platform() {
  case "${{ runner.os }}" in
    "Linux") os_name="linux" ;;
    "macOS") os_name="darwin" ;;
    *) error_exit "Unsupported" ;;
  esac
  # ... 50 more lines
}

# Retry logic
download_with_retry() {
  # ... 40 lines of retry logic
}
```

### After (TypeScript - ~300 lines)
```typescript
import { detectPlatform } from '@fastertools/shared/platform';
import { downloadWithRetry } from '@fastertools/shared/network';
import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    const version = core.getInput('version');
    const platform = detectPlatform();
    
    const url = getFtlDownloadUrl(version, platform);
    const binary = await downloadWithRetry(url);
    
    await installBinary(binary, platform);
    core.setOutput('ftl-version', version);
  } catch (error) {
    core.setFailed(`Installation failed: ${error.message}`);
  }
}
```

## Conclusion

This V3 plan correctly implements GitHub Actions JavaScript action model, focusing on maintainability through:
- 65% code reduction
- Full type safety
- Extensive code reuse
- Better error handling
- Comprehensive testing

The 200-500ms Node.js overhead is negligible compared to the maintainability gains. The team gets debuggable, type-safe code that's easier to modify and extend.