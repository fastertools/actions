# V2 Shell Hardening Plan: Production-Ready GitHub Action

## Executive Summary

Based on comprehensive risk analysis from the brownfield modernization specialist and monkey paw risk analyzer, this V2 plan focuses on **hardening the existing shell implementation** rather than modernizing to TypeScript. This approach eliminates catastrophic failure modes while maintaining the debuggability and reliability that makes the current action production-ready.

**Core Philosophy**: "Don't modernize working code just because it's ugly."

## Risk Analysis Findings

### Critical Risks Avoided by Staying with Shell:
- **No debugging catastrophe**: Users can read and fix shell scripts at 3 AM
- **No cache key collision**: No parallel deployment confusion  
- **No platform detection paradox**: Shell tools report consistent platform info
- **No dependency time bombs**: Zero external dependencies to break
- **No bundling size limits**: No mysterious JavaScript heap errors

### Current State Assessment:
✅ **Working composite action** with proven functionality  
✅ **Zero external dependencies** - only uses standard shell commands  
✅ **Debuggable by users** - clear shell script logic  
✅ **Portable across all GitHub runners**  
✅ **Simple error handling** that users can understand  

## V2 Hardening Implementation Plan

### Phase 1: Defensive Programming Improvements

#### 1.1 Enhanced Error Handling
```yaml
# Add to action.yml steps
- name: Install with Enhanced Error Handling  
  shell: bash
  run: |
    set -euo pipefail  # Fail fast on errors, undefined vars, pipe failures
    
    # Global error trap
    trap 'echo "ERROR: Script failed at line $LINENO. Exit code: $?" >&2' ERR
    
    # Enhanced error reporting function
    error_exit() {
      echo "ERROR: $1" >&2
      echo "Debug info:"
      echo "  OS: ${{ runner.os }}"
      echo "  Architecture: ${{ runner.arch }}"
      echo "  Shell: $SHELL"
      echo "  Working directory: $(pwd)"
      exit 1
    }
```

#### 1.2 Network Operation Resilience
```bash
# Retry logic for downloads
download_with_retry() {
  local url=$1
  local output=$2
  local description=${3:-"file"}
  local max_retries=3
  local retry_delay=5
  local attempt=1
  
  echo "📥 Downloading $description..."
  
  while [ $attempt -le $max_retries ]; do
    echo "Attempt $attempt of $max_retries: $url"
    
    if curl -fsSL --connect-timeout 10 --max-time 120 "$url" -o "$output"; then
      echo "✅ Successfully downloaded $description"
      return 0
    fi
    
    echo "⚠️ Download attempt $attempt failed"
    if [ $attempt -lt $max_retries ]; then
      echo "Retrying in ${retry_delay} seconds..."
      sleep $retry_delay
      retry_delay=$((retry_delay * 2))  # Exponential backoff
    fi
    attempt=$((attempt + 1))
  done
  
  error_exit "Failed to download $description after $max_retries attempts from $url"
}
```

#### 1.3 Input Validation and Sanitization
```bash
# Validate inputs
validate_inputs() {
  local version="${{ inputs.version }}"
  local install_deps="${{ inputs.install-dependencies }}"
  
  # Version validation
  if [[ -n "$version" && "$version" != "latest" ]]; then
    if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9-]+)?$ ]]; then
      error_exit "Invalid version format: '$version'. Expected format: X.Y.Z or X.Y.Z-suffix"
    fi
  fi
  
  # Boolean validation
  case "$install_deps" in
    "true"|"false") ;;
    *) error_exit "install-dependencies must be 'true' or 'false', got: '$install_deps'" ;;
  esac
  
  echo "✅ Input validation passed"
}
```

### Phase 2: Enhanced Logging and Debugging

#### 2.1 Structured Progress Logging
```yaml
- name: Debug Information
  if: runner.debug == '1' || inputs.debug == 'true'
  shell: bash
  run: |
    echo "::group::🔍 Environment Debug Information"
    echo "Runner OS: ${{ runner.os }}"
    echo "Runner Architecture: ${{ runner.arch }}"  
    echo "Shell: $SHELL"
    echo "Shell Version: $($SHELL --version | head -1)"
    echo "Current PATH: $PATH"
    echo "Working Directory: $(pwd)"
    echo "User: $(whoami)"
    echo "Available disk space: $(df -h . | tail -1)"
    echo "Available memory: $(free -h 2>/dev/null || echo 'N/A (not Linux)')"
    
    echo ""
    echo "🔧 Tool Availability Check:"
    for tool in curl jq unzip tar; do
      if command -v $tool >/dev/null 2>&1; then
        echo "✅ $tool: $(command -v $tool) ($(${tool} --version 2>&1 | head -1 || echo 'version unknown'))"
      else
        echo "❌ $tool: not found"
      fi
    done
    echo "::endgroup::"
```

#### 2.2 Progress Tracking with Groups
```bash
# Structured logging functions
start_group() {
  echo "::group::$1"
}

end_group() {
  echo "::endgroup::"
}

log_info() {
  echo "ℹ️ $1"
}

log_success() {
  echo "✅ $1"  
}

log_warning() {
  echo "⚠️ $1"
}

log_step() {
  echo "📝 Step: $1"
}
```

### Phase 3: Comprehensive Validation

#### 3.1 Platform Detection with Verification
```bash
detect_platform() {
  start_group "🔍 Platform Detection"
  
  local os_name arch_name
  
  # Primary detection
  case "${{ runner.os }}" in
    "Linux")
      os_name="linux"
      ;;
    "macOS") 
      os_name="darwin"
      ;;
    "Windows")
      os_name="windows"
      ;;
    *)
      error_exit "Unsupported runner OS: ${{ runner.os }}"
      ;;
  esac
  
  case "${{ runner.arch }}" in
    "X64"|"x64")
      arch_name="x86_64"
      ;;
    "ARM64"|"arm64")
      arch_name="aarch64"  
      ;;
    *)
      error_exit "Unsupported runner architecture: ${{ runner.arch }}"
      ;;
  esac
  
  # Verification with shell commands
  if command -v uname >/dev/null 2>&1; then
    local shell_os shell_arch
    shell_os=$(uname -s | tr '[:upper:]' '[:lower:]')
    shell_arch=$(uname -m)
    
    log_info "Runner reports: ${{ runner.os }}/${{ runner.arch }}"
    log_info "Shell reports: $shell_os/$shell_arch"
    
    # Warn about mismatches but don't fail
    if [[ "$shell_os" != *"$os_name"* ]] && [[ "$os_name" != *"$shell_os"* ]]; then
      log_warning "OS detection mismatch between runner and shell"
    fi
  fi
  
  # Set global variables
  DETECTED_OS="$os_name"
  DETECTED_ARCH="$arch_name"
  PLATFORM_STRING="${arch_name}-unknown-${os_name}-gnu"
  
  log_success "Platform detected: $PLATFORM_STRING"
  end_group
}
```

#### 3.2 Installation Verification
```bash
verify_installation() {
  start_group "🧪 Installation Verification"
  
  # Check if binary exists and is executable
  if ! command -v ftl >/dev/null 2>&1; then
    error_exit "ftl command not found in PATH after installation"
  fi
  
  local ftl_path
  ftl_path=$(command -v ftl)
  log_info "ftl found at: $ftl_path"
  
  # Check file permissions
  if [[ ! -x "$ftl_path" ]]; then
    error_exit "ftl binary is not executable: $ftl_path"
  fi
  
  # Test basic functionality
  log_step "Testing ftl --version"
  local version_output
  if ! version_output=$(ftl --version 2>&1); then
    error_exit "ftl --version failed: $version_output"
  fi
  
  log_success "ftl version: $version_output"
  
  # Test help command
  log_step "Testing ftl --help"
  if ! ftl --help >/dev/null 2>&1; then
    log_warning "ftl --help failed, but --version worked (possibly expected)"
  else
    log_success "ftl --help works"
  fi
  
  # Extract version for output
  local version_number
  version_number=$(echo "$version_output" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [[ -n "$version_number" ]]; then
    echo "ftl-version=$version_number" >> "$GITHUB_OUTPUT"
    log_success "Set output ftl-version=$version_number"
  else
    log_warning "Could not extract version number from: $version_output"
    echo "ftl-version=unknown" >> "$GITHUB_OUTPUT"
  fi
  
  end_group
}
```

### Phase 4: Testing Strategy

#### 4.1 Test Matrix Definition
```yaml
# .github/workflows/test.yml
name: Test Action

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, ubuntu-20.04, macos-latest, macos-13]
        version: [latest, "1.0.0"]  # Replace with actual versions
        install-deps: [true, false]
        include:
          # Test specific combinations
          - os: ubuntu-latest
            version: latest  
            install-deps: true
            debug: true
            
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Test Action
        id: test-action
        uses: ./
        with:
          version: ${{ matrix.version }}
          install-dependencies: ${{ matrix.install-deps }}
          debug: ${{ matrix.debug }}
          
      - name: Verify Installation
        run: |
          echo "Installed version: ${{ steps.test-action.outputs.ftl-version }}"
          ftl --version
          
      - name: Test Basic Functionality
        run: |
          # Add actual functionality tests here
          ftl --help || echo "Help command failed (may be expected)"
```

#### 4.2 Integration Tests
```yaml
# Integration test that actually uses the tool
- name: Integration Test
  run: |
    # Create test scenario that exercises the tool
    echo "Running integration test..."
    
    # Test that the tool can perform its basic function
    # Replace with actual ftl CLI usage
    ftl version || true
    
    # Test with different inputs if applicable
    echo "Integration test completed"
```

### Phase 5: Implementation Checklist

#### 5.1 Required Changes to action.yml
- [ ] Add `set -euo pipefail` to all shell steps
- [ ] Add error trap and error_exit function
- [ ] Implement download_with_retry function  
- [ ] Add input validation step
- [ ] Add debug information step (conditional)
- [ ] Add platform detection with verification
- [ ] Add comprehensive installation verification
- [ ] Add structured logging throughout
- [ ] Update all steps to use new logging functions

#### 5.2 New Files to Create
- [ ] `.github/workflows/test.yml` - Test matrix
- [ ] `.github/workflows/integration.yml` - Integration tests
- [ ] `CHANGELOG.md` - Document improvements
- [ ] Update `README.md` with debug flag

#### 5.3 Version Management
- [ ] Tag current version as `v1.0.0-stable` before changes
- [ ] Implement changes as `v1.1.0-beta`
- [ ] Test thoroughly before promoting to `v1.1.0`

## Benefits of V2 Hardening Plan

### ✅ Maintains All Current Advantages:
- **Zero dependency risk** - still just shell and curl
- **User debuggable** - enhanced error messages help users fix issues
- **Reliable** - retry logic and validation prevent transient failures  
- **Portable** - works on all GitHub runner types

### ✅ Adds Production Hardening:
- **Better error handling** - clear error messages with context
- **Network resilience** - retry logic for flaky connections
- **Input validation** - prevents invalid configurations
- **Comprehensive verification** - catches installation issues early
- **Enhanced debugging** - optional verbose logging for troubleshooting

### ✅ Future-Proofs Without Breaking:
- **Additive only** - no breaking changes to inputs/outputs
- **Backward compatible** - existing workflows continue working
- **Debug-friendly** - optional debug mode for development
- **Test coverage** - comprehensive test matrix prevents regressions

## Rollout Plan

1. **Development**: Implement changes in feature branch
2. **Testing**: Run full test matrix on multiple scenarios  
3. **Beta**: Tag as `v1.1.0-beta` for early adopters
4. **Validation**: Monitor for any issues, gather feedback
5. **Release**: Promote to `v1.1.0` and update `v1` tag
6. **Documentation**: Update README with new debug capabilities

## Success Criteria

- [ ] All existing workflows continue working without changes
- [ ] New error handling catches and reports issues clearly  
- [ ] Retry logic handles transient network failures
- [ ] Debug mode provides useful troubleshooting information
- [ ] Test matrix passes on all supported platforms
- [ ] No new dependencies introduced
- [ ] Performance impact is negligible (<5% increase in runtime)

---

**This V2 hardening plan preserves the debuggability and reliability of the shell-based approach while adding production-grade error handling and resilience.**