# Setup FTL CLI Action

[![Test Action](https://github.com/fastertools/actions/workflows/test.yml/badge.svg)](https://github.com/fastertools/actions/actions/workflows/test.yml)

A production-hardened GitHub Action that installs the FTL CLI and its dependencies (Spin WebAssembly runtime, wkg, Docker Buildx) with comprehensive error handling, retry logic, and caching.

## Usage

### Quick Start

```yaml
steps:
  - name: Setup FTL CLI
    uses: fastertools/actions/actions/setup-ftl@v1
    with:
      version: 'latest'
      install-dependencies: true
```

### With Dependencies

```yaml
- name: Install FTL CLI with dependencies
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: '1.0.0'
    install-dependencies: true
    cache-dependencies: true
```

### Debug Mode

When troubleshooting installation issues, enable debug mode for detailed logging:

```yaml
- name: Install FTL CLI (debug mode)
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    install-dependencies: true
    debug: true  # Enable detailed logging
```

## Features

✅ **Production Hardened**: V2 shell implementation with comprehensive error handling  
✅ **Network Resilient**: Exponential backoff retry logic for downloads  
✅ **Input Validated**: Strict validation prevents configuration errors  
✅ **Debug Friendly**: Optional verbose logging for troubleshooting  
✅ **Fast Caching**: Intelligent dependency caching with proper cache keys  
✅ **Platform Support**: Linux (x64, ARM64) and macOS (x64, ARM64)  
✅ **Zero Dependencies**: Pure shell implementation - no external dependencies  

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `version` | FTL CLI version to install (`latest` or semver like `1.0.0`) | No | `latest` |
| `install-dependencies` | Install dependencies (Spin, wkg, Docker Buildx) | No | `true` |
| `cache-dependencies` | Cache installed tools for faster subsequent runs | No | `true` |
| `debug` | Enable debug mode with detailed logging | No | `false` |

## Outputs

| Output | Description |
|--------|-------------|
| `ftl-version` | The resolved and installed FTL CLI version |

## Complete Workflow Example

```yaml
name: Build and Deploy with FTL

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        
      - name: Setup FTL CLI
        id: setup-ftl
        uses: fastertools/actions/actions/setup-ftl@v1
        with:
          version: 'latest'
          install-dependencies: true
          cache-dependencies: true
          
      - name: Verify Installation
        run: |
          echo "Installed FTL CLI version: ${{ steps.setup-ftl.outputs.ftl-version }}"
          ftl --version
          spin --version
          wkg --version
          
      - name: Build and Deploy
        run: |
          # Your FTL CLI commands here
          ftl build
          ftl deploy
```

## Supported Platforms

| OS | Architecture | Status |
|----|--------------|--------|
| Ubuntu Latest | x64 | ✅ Fully Supported |
| Ubuntu Latest | ARM64 | ✅ Fully Supported |
| Ubuntu 20.04 | x64 | ✅ Fully Supported |
| Ubuntu 20.04 | ARM64 | ✅ Fully Supported |
| macOS Latest | x64 (Intel) | ✅ Fully Supported |
| macOS Latest | ARM64 (Apple Silicon) | ✅ Fully Supported |
| macOS 13 | x64 (Intel) | ✅ Fully Supported |
| macOS 13 | ARM64 (Apple Silicon) | ✅ Fully Supported |
| Windows | x64 | ❌ Not Yet Supported |
| Windows | ARM64 | ❌ Not Yet Supported |

## Advanced Usage

### Using Specific Versions

```yaml
- name: Install specific FTL version
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: '1.2.3'  # Must be valid semver
    install-dependencies: true
```

### Disable Caching (for testing)

```yaml
- name: Install without caching
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    cache-dependencies: false
```

### Minimal Installation (FTL only)

```yaml
- name: Install FTL CLI only
  uses: fastertools/actions/actions/setup-ftl@v1
  with:
    version: 'latest'
    install-dependencies: false
```

## Debug Mode

Debug mode provides comprehensive troubleshooting information:

- Environment information (OS, architecture, disk space, memory)
- Tool availability checks (curl, jq, unzip, tar)
- Platform detection details
- Cache path verification
- Detailed download progress
- Installation verification steps

## Error Handling

The action includes comprehensive error handling:

- **Input Validation**: Validates version format and boolean inputs
- **Network Resilience**: Retry logic with exponential backoff for downloads
- **Installation Verification**: Confirms all tools are properly installed and executable
- **Clear Error Messages**: Detailed error reporting with context information
- **Fail Fast**: Stops on first error with clear indication of what failed

### Common Error Scenarios

1. **Invalid Version Format**
   ```
   ERROR: Invalid version format: 'v1.0.0'. Expected format: X.Y.Z or X.Y.Z-suffix
   ```
   Solution: Use `1.0.0` instead of `v1.0.0`

2. **Network Issues**
   ```
   ERROR: Failed to download FTL CLI binary after 3 attempts from https://...
   ```
   Solution: Retry the workflow or check network connectivity

3. **Platform Not Supported**
   ```
   ERROR: Unsupported runner OS: Windows
   ```
   Solution: Use a supported Linux or macOS runner

## Caching

The action automatically caches installed tools to speed up subsequent runs:

- **Cache Key**: Based on OS, architecture, FTL version, and dependencies setting
- **Cached Paths**: FTL CLI, Spin, wkg, and Cargo registry
- **Automatic Cleanup**: GitHub Actions automatically manages cache lifecycle

## Troubleshooting

### Enable Debug Mode

First, enable debug mode to get detailed logging:

```yaml
- uses: fastertools/actions/actions/setup-ftl@v1
  with:
    debug: true
```

### Check Runner Compatibility

Ensure you're using a supported runner:
- ✅ `ubuntu-latest`, `ubuntu-20.04`
- ✅ `macos-latest`, `macos-13`
- ❌ `windows-*` (not yet supported)

### Verify Version Format

Version must be either `latest` or valid semver:
- ✅ `latest`
- ✅ `1.0.0`
- ✅ `2.1.3-beta`
- ❌ `v1.0.0`
- ❌ `1.0`

## Architecture

This action uses a hardened shell-based implementation for maximum reliability and debuggability:

- **Shell-based**: Pure bash scripts with comprehensive error handling
- **No external dependencies**: Only uses standard shell commands and curl
- **Modular functions**: Reusable functions for platform detection, downloads, and verification
- **Structured logging**: GitHub Actions groups and emoji-based progress indicators
- **Production-ready**: Extensive error handling, input validation, and verification

---

*This action implements V2 hardened shell implementation based on comprehensive risk analysis and production best practices.*